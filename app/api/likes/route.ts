import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import type { Like } from '@/types';

// GET /api/likes?track_id=xxx&user_id=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('track_id');
    const userId = searchParams.get('user_id');

    if (!isNeonConfigured) {
      return NextResponse.json({ likes: [] });
    }

    const where: Record<string, string> = {};
    if (trackId) where.faixaId = trackId;
    if (userId) where.usuarioId = userId;

    const curtidas = await db.curtida.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const likes: Like[] = curtidas.map((c) => ({
      id: c.id,
      user_id: c.usuarioId,
      track_id: c.faixaId,
      created_at: c.createdAt.toISOString(),
    }));

    return NextResponse.json({ likes });
  } catch (error) {
    console.error('[LIKES GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar curtidas' }, { status: 500 });
  }
}

// POST /api/likes — Toggle like on a track (authenticated)
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { track_id } = await request.json();
    if (!track_id) {
      return NextResponse.json({ error: 'track_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ message: 'Neon não configurado' }, { status: 503 });
    }

    // Check if already liked
    const existing = await db.curtida.findUnique({
      where: {
        usuarioId_faixaId: {
          usuarioId: userId,
          faixaId: track_id,
        },
      },
    });

    if (existing) {
      // Unlike
      await db.curtida.delete({ where: { id: existing.id } });
      return NextResponse.json({ liked: false });
    }

    // Like
    const curtida = await db.curtida.create({
      data: {
        usuarioId: userId,
        faixaId: track_id,
      },
    });

    return NextResponse.json({
      liked: true,
      like: {
        id: curtida.id,
        user_id: curtida.usuarioId,
        track_id: curtida.faixaId,
        created_at: curtida.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[LIKES POST]', error);
    return NextResponse.json({ error: 'Erro ao processar curtida' }, { status: 500 });
  }
}

// DELETE /api/likes?id=xxx
export async function DELETE(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ message: 'Neon não configurado' }, { status: 503 });
    }

    await db.curtida.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[LIKES DELETE]', error);
    return NextResponse.json({ error: 'Erro ao deletar curtida' }, { status: 500 });
  }
}
