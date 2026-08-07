import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { isR2Configured, isNeonConfigured } from '@/lib/config';
import { uploadToR2, deleteFromR2 } from '@/lib/r2';
import { db } from '@/lib/db';
import {
  processImage,
  assertClientUploadSize,
  assertAllowedMime,
  ImageProcessError,
  ALBUM_MAX_PHOTOS,
} from '@/lib/imageProcess';
import { checkRateLimit } from '@/lib/rateLimit';
import crypto from 'crypto';

function mapPhoto(p: {
  id: string;
  url: string;
  key: string;
  sortOrder: number;
  width: number | null;
  height: number | null;
  bytes: number | null;
  createdAt: Date;
}) {
  return {
    id: p.id,
    url: p.url,
    key: p.key,
    sort_order: p.sortOrder,
    width: p.width,
    height: p.height,
    bytes: p.bytes,
    created_at: p.createdAt.toISOString(),
  };
}

// GET /api/album?userId=...
// Lista ordenada das fotos do álbum de um usuário (público).
export async function GET(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Banco não configurado' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    const photos = await db.fotoAlbum.findMany({
      where: { usuarioId: userId },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ photos: photos.map(mapPhoto) });
  } catch (error) {
    console.error('[ALBUM GET]', error);
    return NextResponse.json({ error: 'Erro ao listar álbum' }, { status: 500 });
  }
}

// POST /api/album
// Auth obrigatória. Valida contagem < 8, processa imagem e grava.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Banco não configurado' }, { status: 503 });
    }

    const rl = checkRateLimit(`media:album:${userId}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitos uploads. Tente de novo em ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    const count = await db.fotoAlbum.count({ where: { usuarioId: userId } });
    if (count >= ALBUM_MAX_PHOTOS) {
      return NextResponse.json(
        { error: `Limite de ${ALBUM_MAX_PHOTOS} fotos no álbum atingido.` },
        { status: 400 }
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
      processed = await processImage(raw, 'album', file.type);
    } catch (e) {
      if (e instanceof ImageProcessError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const filename = `${userId}-${crypto.randomBytes(8).toString('hex')}.${processed.ext}`;
    let key = `album/${userId}/${filename}`;
    let publicUrl: string;

    if (isR2Configured) {
      publicUrl = await uploadToR2(key, processed.buffer, processed.contentType);
    } else {
      const dir = join(process.cwd(), 'public', 'album', userId);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, filename), processed.buffer);
      publicUrl = `/album/${userId}/${filename}`;
      key = `local:${publicUrl}`;
    }

    // sortOrder = próximo índice (0-based)
    const maxOrder = await db.fotoAlbum.aggregate({
      where: { usuarioId: userId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const photo = await db.fotoAlbum.create({
      data: {
        usuarioId: userId,
        url: publicUrl,
        key,
        sortOrder,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
      },
    });

    return NextResponse.json({ photo: mapPhoto(photo) }, { status: 201 });
  } catch (error) {
    console.error('[ALBUM POST]', error);
    return NextResponse.json({ error: 'Erro ao adicionar foto ao álbum' }, { status: 500 });
  }
}

// PATCH /api/album
// Body: { order: string[] } — array de ids na nova ordem. Só o dono.
export async function PATCH(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Banco não configurado' }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const order = body?.order as string[] | undefined;
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json(
        { error: 'Envie { order: string[] } com os ids na nova ordem' },
        { status: 400 }
      );
    }

    const existing = await db.fotoAlbum.findMany({
      where: { usuarioId: userId },
      select: { id: true },
    });
    const owned = new Set(existing.map((p) => p.id));
    if (order.length !== owned.size || order.some((id) => !owned.has(id))) {
      return NextResponse.json(
        { error: 'A ordem deve incluir exatamente todas as suas fotos' },
        { status: 400 }
      );
    }

    await db.$transaction(
      order.map((id, index) =>
        db.fotoAlbum.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    const photos = await db.fotoAlbum.findMany({
      where: { usuarioId: userId },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ photos: photos.map(mapPhoto) });
  } catch (error) {
    console.error('[ALBUM PATCH]', error);
    return NextResponse.json({ error: 'Erro ao reordenar álbum' }, { status: 500 });
  }
}

// DELETE /api/album?id=...
// Só o dono; remove R2 + row.
export async function DELETE(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Banco não configurado' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const photo = await db.fotoAlbum.findUnique({ where: { id } });
    if (!photo) {
      return NextResponse.json({ error: 'Foto não encontrada' }, { status: 404 });
    }
    if (photo.usuarioId !== userId) {
      return NextResponse.json({ error: 'Você só pode remover fotos do seu álbum' }, { status: 403 });
    }

    if (isR2Configured && photo.key && !photo.key.startsWith('local:')) {
      try {
        await deleteFromR2(photo.key);
      } catch (err) {
        console.warn('[ALBUM DELETE] falha ao apagar no R2:', photo.key, err);
      }
    }

    await db.fotoAlbum.delete({ where: { id } });

    // Recompacta sortOrder
    const remaining = await db.fotoAlbum.findMany({
      where: { usuarioId: userId },
      orderBy: { sortOrder: 'asc' },
    });
    if (remaining.length > 0) {
      await db.$transaction(
        remaining.map((p, index) =>
          db.fotoAlbum.update({
            where: { id: p.id },
            data: { sortOrder: index },
          })
        )
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ALBUM DELETE]', error);
    return NextResponse.json({ error: 'Erro ao remover foto do álbum' }, { status: 500 });
  }
}
