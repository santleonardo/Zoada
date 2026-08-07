// Constantes compartilhadas client/server (sem sharp).
// Limites de processamento ficam em imageProcess.ts (server-only).

export type ImageKind = 'album' | 'avatar' | 'club_cover' | 'other';

export interface ImageLimits {
  maxDimension: number;
  maxBytes: number;
  dimensionMode: 'longest' | 'width';
}

export const IMAGE_LIMITS: Record<ImageKind, ImageLimits> = {
  album: { maxDimension: 1280, maxBytes: 350 * 1024, dimensionMode: 'longest' },
  avatar: { maxDimension: 512, maxBytes: 150 * 1024, dimensionMode: 'longest' },
  club_cover: { maxDimension: 1600, maxBytes: 400 * 1024, dimensionMode: 'width' },
  other: { maxDimension: 1280, maxBytes: 350 * 1024, dimensionMode: 'longest' },
};

/** Máximo de arquivos no álbum por usuário (teto técnico). Meta de produto ~5. */
export const ALBUM_MAX_PHOTOS = 8;

/** Tamanho máximo do arquivo original no client (antes do process no servidor). */
export const CLIENT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

/** accept= para inputs de arquivo de imagem no client. */
export const IMAGE_INPUT_ACCEPT = ALLOWED_IMAGE_MIME.join(',');
