import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { uploadToR2, getPresignedUrl, getPublicUrl } from '@/lib/r2';
import { isR2Configured } from '@/lib/config';
import {
  processImage,
  assertClientUploadSize,
  assertAllowedMime,
  ImageProcessError,
  type ImageKind,
} from '@/lib/imageProcess';
import { checkRateLimit } from '@/lib/rateLimit';

// POST /api/storage/upload
// Upload de imagem para R2 — sempre processa (resize/compress) antes de gravar.
// Áudio NÃO passa por aqui (usa presign direto).
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isR2Configured) {
      return NextResponse.json(
        {
          error:
            'R2 não configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY no .env',
        },
        { status: 503 }
      );
    }

    const rl = checkRateLimit(`media:storage:${userId}`, 40, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitos uploads. Tente de novo em ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    try {
      assertAllowedMime(file.type);
      assertClientUploadSize(file.size);
    } catch (e) {
      if (e instanceof ImageProcessError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    // Escolhe limites conforme a pasta (avatars vs capas vs genérico).
    let kind: ImageKind = 'other';
    if (folder === 'avatars') kind = 'avatar';
    else if (folder === 'clubs' || folder === 'covers') kind = 'club_cover';
    else if (folder === 'album') kind = 'album';

    const raw = Buffer.from(await file.arrayBuffer());
    let processed;
    try {
      processed = await processImage(raw, kind, file.type);
    } catch (e) {
      if (e instanceof ImageProcessError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const key = `${folder}/${userId}/${Date.now()}-${cryptoRandom()}.${processed.ext}`;
    const publicUrl = await uploadToR2(key, processed.buffer, processed.contentType);

    return NextResponse.json(
      {
        key,
        url: publicUrl,
        name: file.name,
        size: processed.bytes,
        type: processed.contentType,
        width: processed.width,
        height: processed.height,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[STORAGE UPLOAD]', error);
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 });
  }
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// GET /api/storage/presign?key=xxx&expires=3600
// Generate a presigned URL for private files
export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const expires = parseInt(searchParams.get('expires') || '3600', 10);

    if (!key) {
      return NextResponse.json({ error: 'key é obrigatório' }, { status: 400 });
    }

    if (!isR2Configured) {
      return NextResponse.json({ error: 'R2 não configurado' }, { status: 503 });
    }

    const url = await getPresignedUrl(key, expires);
    return NextResponse.json({ url, key, publicUrl: getPublicUrl(key) });
  } catch (error) {
    console.error('[STORAGE PRESIGN]', error);
    return NextResponse.json({ error: 'Erro ao gerar URL' }, { status: 500 });
  }
}
