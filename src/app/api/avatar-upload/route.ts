import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { isR2Configured } from '@/lib/config';
import { uploadToR2 } from '@/lib/r2';
import {
  processImage,
  assertClientUploadSize,
  assertAllowedMime,
  ImageProcessError,
} from '@/lib/imageProcess';
import { checkRateLimit } from '@/lib/rateLimit';
import crypto from 'crypto';

// POST /api/avatar-upload
// Upload de foto de perfil — sempre processa (resize ≤512, ≤150 KB, WebP/JPEG)
// antes de gravar. Nunca salva o original como versão final.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const rl = checkRateLimit(`media:avatar:${userId}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitos uploads. Tente de novo em ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

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

    const raw = Buffer.from(await file.arrayBuffer());
    let processed;
    try {
      processed = await processImage(raw, 'avatar', file.type);
    } catch (e) {
      if (e instanceof ImageProcessError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const filename = `${userId}-${crypto.randomBytes(8).toString('hex')}.${processed.ext}`;

    if (isR2Configured) {
      const key = `avatars/${userId}/${filename}`;
      const publicUrl = await uploadToR2(key, processed.buffer, processed.contentType);
      return NextResponse.json({
        url: publicUrl,
        key,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
      });
    }

    // Fallback local: salva em public/avatars/
    const avatarsDir = join(process.cwd(), 'public', 'avatars');
    await mkdir(avatarsDir, { recursive: true });
    const filePath = join(avatarsDir, filename);
    await writeFile(filePath, processed.buffer);

    const publicUrl = `/avatars/${filename}`;
    return NextResponse.json({
      url: publicUrl,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
    });
  } catch (error) {
    console.error('[AVATAR UPLOAD]', error);
    return NextResponse.json({ error: 'Erro ao fazer upload do avatar' }, { status: 500 });
  }
}
