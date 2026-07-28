import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2_CONFIG } from './config';
import { isR2Configured } from './config';

// ---------- S3 Client (R2-compatible) ----------
let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!isR2Configured) {
    throw new Error('[ZÔADA] R2 não configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY no .env');
  }
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_CONFIG.ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_CONFIG.ACCESS_KEY_ID,
        secretAccessKey: R2_CONFIG.SECRET_ACCESS_KEY,
      },
      // Desde versões recentes do AWS SDK v3, o cliente passa a incluir por
      // padrão um checksum (CRC32) na assinatura de toda URL pré-assinada.
      // O R2 (e outros S3-compatíveis) valida a assinatura à risca, mas o
      // PUT feito direto pelo navegador (fetch simples) não envia esse
      // checksum — resultado: 403 Forbidden mesmo com credenciais corretas.
      // Desativamos aqui para manter as URLs pré-assinadas compatíveis.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return _s3Client;
}

// ---------- Upload file to R2 ----------
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array | string | ReadableStream,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  await client.send(new PutObjectCommand({
    Bucket: R2_CONFIG.BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return getPublicUrl(key);
}

// ---------- Delete file from R2 ----------
export async function deleteFromR2(key: string): Promise<void> {
  const client = getS3Client();
  await client.send(new DeleteObjectCommand({
    Bucket: R2_CONFIG.BUCKET_NAME,
    Key: key,
  }));
}

// ---------- Get public URL ----------
export function getPublicUrl(key: string): string {
  if (R2_CONFIG.PUBLIC_URL) {
    return `${R2_CONFIG.PUBLIC_URL}/${key}`;
  }
  return `https://${R2_CONFIG.ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_CONFIG.BUCKET_NAME}/${key}`;
}

// ---------- Reverse of getPublicUrl: recover the R2 key from a public URL ----------
// Usado quando apagamos uma faixa: o banco só guarda a URL pública, então
// precisamos "desfazer" o getPublicUrl acima pra saber qual objeto apagar no R2.
export function keyFromPublicUrl(url: string): string | null {
  if (!url) return null;
  const bases = [
    R2_CONFIG.PUBLIC_URL,
    `https://${R2_CONFIG.ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_CONFIG.BUCKET_NAME}`,
  ].filter(Boolean) as string[];

  for (const base of bases) {
    if (url.startsWith(`${base}/`)) {
      return url.slice(base.length + 1);
    }
  }
  return null;
}

// ---------- Generate signed (presigned) URL for private files ----------
export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: R2_CONFIG.BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

// ---------- Generate signed PUT URL so the BROWSER uploads straight to R2 ----------
// Necessário porque o Vercel limita o corpo de uma Serverless Function a ~4.5MB;
// arquivos de áudio maiores que isso nunca chegariam no endpoint /api/storage/upload.
// Com isso, o navegador manda o arquivo direto pro R2, sem passar pelo Vercel.
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 600
): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: R2_CONFIG.BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}
