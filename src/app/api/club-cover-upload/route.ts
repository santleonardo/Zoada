import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { isR2Configured, isNeonConfigured } from '@/lib/config';
import { uploadToR2 } from '@/lib/r2';
import { db } from '@/lib/db';
import {
  processImage,
  assertClientUploadSize,
  assertAllowedMime,
  ImageProcessError,
} from '@/lib/imageProcess';
import { checkRateLimit } from '@/lib/rateLimit';
import crypto from 'crypto';

// POST /api/club-cover-upload
// Upload da capa de um clube — processa (largura ≤1600, ≤400 KB) antes de gravar.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const clubId = formData.get('club_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }
    if (!clubId) {
      return NextResponse.json({ error: 'club_id é obrigatório' }, { status: 400 });
    }

    const rl = checkRateLimit(`media:club-cover:${userId}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitos uploads. Tente de novo em ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    if (isNeonConfigured) {
      const meuVinculo = await db.membroClube.findUnique({
        where: { clubeId_usuarioId: { clubeId: clubId, usuarioId: userId } },
      });
      if (!meuVinculo || meuVinculo.papel !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Só o admin do clube pode trocar a capa' },
          { status: 403 }
        );
      }
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
      processed = await processImage(raw, 'club_cover', file.type);
    } catch (e) {
      if (e instanceof ImageProcessError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const filename = `${clubId}-${crypto.randomBytes(8).toString('hex')}.${processed.ext}`;

    if (isR2Configured) {
      const key = `clubs/${clubId}/${filename}`;
      const publicUrl = await uploadToR2(key, processed.buffer, processed.contentType);
      return NextResponse.json({
        url: publicUrl,
        key,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
      });
    }

    const clubsDir = join(process.cwd(), 'public', 'clubs');
    await mkdir(clubsDir, { recursive: true });
    const filePath = join(clubsDir, filename);
    await writeFile(filePath, processed.buffer);

    const publicUrl = `/clubs/${filename}`;
    return NextResponse.json({
      url: publicUrl,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
    });
  } catch (error) {
    console.error('[CLUB COVER UPLOAD]', error);
    return NextResponse.json({ error: 'Erro ao fazer upload da capa' }, { status: 500 });
  }
}
