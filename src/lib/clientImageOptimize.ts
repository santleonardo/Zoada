/**
 * Pré-otimização de imagens no navegador (Canvas).
 * Reduz bytes enviados ao servidor; o servidor ainda processa de novo
 * com sharp (fonte da verdade dos tetos). Não substitui o processImage.
 */

import {
  CLIENT_MAX_UPLOAD_BYTES,
  IMAGE_LIMITS,
  type ImageKind,
  ALLOWED_IMAGE_MIME,
} from './imageLimits';

export class ClientImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientImageError';
  }
}

function assertAllowedFile(file: File): void {
  if (file.size > CLIENT_MAX_UPLOAD_BYTES) {
    throw new ClientImageError(
      'Imagem muito grande (máx. 5 MB). Escolha um arquivo menor.'
    );
  }
  // type vazio em alguns HEIC/Android — deixa o servidor decidir
  if (file.type && !(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) {
    throw new ClientImageError(
      'Tipo não permitido. Use JPG, PNG, WebP, HEIC ou HEIF.'
    );
  }
}

function loadImageBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file).catch(async () => {
    // Fallback via HTMLImageElement (alguns browsers/HEIC)
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('decode failed'));
        el.src = url;
      });
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  });
}

/**
 * Redimensiona e exporta como WebP (ou JPEG se WebP falhar) no client.
 * Se a imagem já for pequena o suficiente, devolve o File original.
 */
export async function optimizeImageClient(
  file: File,
  kind: ImageKind = 'other'
): Promise<File> {
  assertAllowedFile(file);

  const limits = IMAGE_LIMITS[kind];
  // Alvo um pouco abaixo do teto final pra sobrar margem ao reprocessar no server
  const targetBytes = Math.floor(limits.maxBytes * 0.92);

  let bitmap: ImageBitmap;
  try {
    bitmap = await loadImageBitmap(file);
  } catch {
    // HEIC sem suporte no browser: envia original (servidor processa com sharp)
    return file;
  }

  try {
    let { width, height } = bitmap;
    if (!width || !height) return file;

    if (limits.dimensionMode === 'width') {
      if (width > limits.maxDimension) {
        const scale = limits.maxDimension / width;
        width = limits.maxDimension;
        height = Math.max(1, Math.round(height * scale));
      }
    } else {
      const longest = Math.max(width, height);
      if (longest > limits.maxDimension) {
        const scale = limits.maxDimension / longest;
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const qualities = [0.82, 0.72, 0.62, 0.52, 0.42, 0.32];
    const tryEncode = async (
      mime: 'image/webp' | 'image/jpeg',
      quality: number
    ): Promise<Blob | null> => {
      return new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), mime, quality);
      });
    };

    // Preferência WebP
    for (const q of qualities) {
      const blob = await tryEncode('image/webp', q);
      if (blob && blob.size <= targetBytes) {
        const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
        return new File([blob], name, { type: 'image/webp' });
      }
    }

    for (const q of qualities) {
      const blob = await tryEncode('image/jpeg', q);
      if (blob && blob.size <= targetBytes) {
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], name, { type: 'image/jpeg' });
      }
    }

    // Não conseguiu caber no alvo: devolve o menor WebP/JPEG obtido ou original
    const lastWebp = await tryEncode('image/webp', 0.32);
    if (lastWebp && lastWebp.size < file.size) {
      return new File([lastWebp], file.name.replace(/\.[^.]+$/, '') + '.webp', {
        type: 'image/webp',
      });
    }
    return file;
  } finally {
    bitmap.close();
  }
}

/** Valida arquivo no client sem processar (para feedback imediato). */
export function validateImageFileClient(file: File): string | null {
  try {
    assertAllowedFile(file);
    return null;
  } catch (e) {
    if (e instanceof ClientImageError) return e.message;
    return 'Arquivo de imagem inválido.';
  }
}
