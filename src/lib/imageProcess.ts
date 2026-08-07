import sharp from 'sharp';
import {
  IMAGE_LIMITS,
  type ImageKind,
  ALLOWED_IMAGE_MIME,
  type AllowedImageMime,
  CLIENT_MAX_UPLOAD_BYTES,
} from './imageLimits';

// Re-export for server consumers
export {
  IMAGE_LIMITS,
  ALBUM_MAX_PHOTOS,
  CLIENT_MAX_UPLOAD_BYTES,
  ALLOWED_IMAGE_MIME,
  type ImageKind,
  type ImageLimits,
  type AllowedImageMime,
} from './imageLimits';

// ============================================================
// Processamento centralizado de imagens (avatar, álbum, capa de
// clube e qualquer outra foto do app).
//
// Política de capacidade R2 (free tier ~10 GB, ~1 GB reservado
// para rádio/catálogo/assets): meta média ≤ 5 fotos de álbum por
// usuário. Se o uso do R2 passar de ~7 GB, reduzir qualidade
// (ex.: maxBytes de álbum/outras de 350 KB → 300 KB) ou planejar
// upgrade do plano — NÃO gravar originais sem limite.
// ============================================================

export class ImageProcessError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_TYPE'
      | 'TOO_LARGE'
      | 'PROCESS_FAILED'
      | 'STILL_TOO_LARGE'
  ) {
    super(message);
    this.name = 'ImageProcessError';
  }
}

export interface ProcessedImage {
  buffer: Buffer;
  contentType: 'image/webp' | 'image/jpeg';
  width: number;
  height: number;
  bytes: number;
  /** Extensão sugerida para o object key (webp ou jpg). */
  ext: 'webp' | 'jpg';
}

function isAllowedMime(type: string): type is AllowedImageMime {
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(type);
}

/**
 * Redimensiona (mantendo aspect ratio) e comprime a imagem até caber no
 * teto do `kind`. Preferência WebP; fallback JPEG se necessário.
 * Só a versão processada deve ser gravada no R2.
 */
export async function processImage(
  input: Buffer,
  kind: ImageKind,
  declaredMime?: string
): Promise<ProcessedImage> {
  const limits = IMAGE_LIMITS[kind];

  if (declaredMime && !isAllowedMime(declaredMime)) {
    throw new ImageProcessError(
      'Tipo de arquivo não permitido. Use JPG, PNG, WebP, HEIC ou HEIF.',
      'INVALID_TYPE'
    );
  }

  let pipeline: sharp.Sharp;
  try {
    pipeline = sharp(input, { failOn: 'none' }).rotate(); // orienta por EXIF
  } catch {
    throw new ImageProcessError(
      'Não foi possível ler a imagem. Envie um arquivo de imagem válido.',
      'PROCESS_FAILED'
    );
  }

  let meta: sharp.Metadata;
  try {
    meta = await pipeline.metadata();
  } catch {
    throw new ImageProcessError(
      'Não foi possível ler a imagem. Envie um arquivo de imagem válido.',
      'PROCESS_FAILED'
    );
  }

  const srcW = meta.width || 0;
  const srcH = meta.height || 0;
  if (!srcW || !srcH) {
    throw new ImageProcessError(
      'Imagem inválida ou sem dimensões.',
      'PROCESS_FAILED'
    );
  }

  // Detecta tipo real quando possível (não confia só no client).
  const format = meta.format;
  if (format && !['jpeg', 'png', 'webp', 'heif', 'gif', 'tiff', 'avif'].includes(format)) {
    throw new ImageProcessError(
      'Tipo de arquivo não permitido. Use JPG, PNG, WebP, HEIC ou HEIF.',
      'INVALID_TYPE'
    );
  }

  const resizeOpts: sharp.ResizeOptions = {
    fit: 'inside',
    withoutEnlargement: true,
  };

  if (limits.dimensionMode === 'width') {
    if (srcW > limits.maxDimension) {
      pipeline = pipeline.resize({ width: limits.maxDimension, ...resizeOpts });
    }
  } else {
    const longest = Math.max(srcW, srcH);
    if (longest > limits.maxDimension) {
      pipeline = pipeline.resize({
        width: srcW >= srcH ? limits.maxDimension : undefined,
        height: srcH > srcW ? limits.maxDimension : undefined,
        ...resizeOpts,
      });
    }
  }

  // Tenta WebP com qualidade decrescente; se ainda passar do teto, tenta JPEG.
  const webpQualities = [82, 72, 62, 52, 42, 32];
  for (const quality of webpQualities) {
    try {
      const buffer = await pipeline.clone().webp({ quality, effort: 4 }).toBuffer();
      if (buffer.length <= limits.maxBytes) {
        const outMeta = await sharp(buffer).metadata();
        return {
          buffer,
          contentType: 'image/webp',
          width: outMeta.width || srcW,
          height: outMeta.height || srcH,
          bytes: buffer.length,
          ext: 'webp',
        };
      }
    } catch {
      // tenta próxima qualidade / fallback
    }
  }

  const jpegQualities = [80, 70, 60, 50, 40, 30];
  for (const quality of jpegQualities) {
    try {
      const buffer = await pipeline
        .clone()
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (buffer.length <= limits.maxBytes) {
        const outMeta = await sharp(buffer).metadata();
        return {
          buffer,
          contentType: 'image/jpeg',
          width: outMeta.width || srcW,
          height: outMeta.height || srcH,
          bytes: buffer.length,
          ext: 'jpg',
        };
      }
    } catch {
      // continua
    }
  }

  throw new ImageProcessError(
    `Não foi possível comprimir a imagem abaixo de ${Math.round(limits.maxBytes / 1024)} KB. Tente outra foto.`,
    'STILL_TOO_LARGE'
  );
}

/** Validação leve no servidor do tamanho bruto do upload (antes do process). */
export function assertClientUploadSize(size: number): void {
  if (size > CLIENT_MAX_UPLOAD_BYTES) {
    throw new ImageProcessError(
      'Imagem muito grande (máx. 5 MB). Escolha um arquivo menor.',
      'TOO_LARGE'
    );
  }
}

/** Validação de MIME declarado pelo client. */
export function assertAllowedMime(type: string): void {
  if (!isAllowedMime(type)) {
    throw new ImageProcessError(
      'Tipo de arquivo não permitido. Use JPG, PNG, WebP, HEIC ou HEIF.',
      'INVALID_TYPE'
    );
  }
}
