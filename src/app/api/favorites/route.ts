import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import type { Favorite } from '@/types';

// GET /api/favorites?track_id=xxx&user_id=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('track_id');
    const userId = searchParams.get('user_id');

    if (!isNeonConfigured) {
      return NextResponse.json({ favorites: [] });
    }

    const where: Record<string, string> = {};
    if (trackId) where.faixaId = trackId;
    if (userId) where.usuarioId = userId;

    const favoritos = await db.favorito.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const favorites: Favorite[] = favoritos.map((f) => ({
      id: f.id,
      user_id: f.usuarioId,
      track_id: f.faixaId,
      created_at: f.createdAt.toISOString(),
    }));

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error('[FAVORITES GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar favoritos' }, { status: 500 });
  }
}

// POST /api/favorites — Toggle favorite on a track (authenticated)
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

    // Já favoritada?
    const existing = await db.favorito.findUnique({
      where: {
        usuarioId_faixaId: {
          usuarioId: userId,
          faixaId: track_id,
        },
      },
    });

    if (existing) {
      // Remove dos favoritos
      await db.favorito.delete({ where: { id: existing.id } });
      return NextResponse.json({ favorited: false });
    }

    // Adiciona aos favoritos
    const favorito = await db.favorito.create({
      data: {
        usuarioId: userId,
        faixaId: track_id,
      },
    });

    return NextResponse.json({
      favorited: true,
      favorite: {
        id: favorito.id,
        user_id: favorito.usuarioId,
        track_id: favorito.faixaId,
        created_at: favorito.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[FAVORITES POST]', error);
    return NextResponse.json({ error: 'Erro ao processar favorito' }, { status: 500 });
  }
}

// DELETE /api/favorites?id=xxx
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

    await db.favorito.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[FAVORITES DELETE]', error);
    return NextResponse.json({ error: 'Erro ao deletar favorito' }, { status: 500 });
  }
}
