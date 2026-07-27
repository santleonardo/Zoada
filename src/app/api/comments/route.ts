import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { DEMO_COMMENTS } from '@/lib/demo-data';
import type { Comment } from '@/types';

// GET /api/comments?track_id=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('track_id');

    if (!trackId) {
      return NextResponse.json({ error: 'track_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      const comments = DEMO_COMMENTS.filter((c) => c.track_id === trackId);
      return NextResponse.json({ comments });
    }

    const comentarios = await db.comentario.findMany({
      where: { faixaId: trackId },
      include: {
        usuario: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const comments: Comment[] = comentarios.map((c) => ({
      id: c.id,
      user_id: c.usuarioId,
      track_id: c.faixaId,
      content: c.conteudo,
      created_at: c.createdAt.toISOString(),
      user: {
        id: c.usuario.id,
        email: '',
        name: c.usuario.name,
        avatar_url: c.usuario.avatarUrl,
        created_at: '',
      },
    }));

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('[COMMENTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar comentários' }, { status: 500 });
  }
}

// POST /api/comments — Add a comment (authenticated)
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { track_id, content } = await request.json();
    if (!track_id || !content) {
      return NextResponse.json({ error: 'track_id e content são obrigatórios' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ message: 'Neon não configurado' }, { status: 503 });
    }

    const comentario = await db.comentario.create({
      data: {
        usuarioId: userId,
        faixaId: track_id,
        conteudo: content,
      },
      include: {
        usuario: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({
      id: comentario.id,
      user_id: comentario.usuarioId,
      track_id: comentario.faixaId,
      content: comentario.conteudo,
      created_at: comentario.createdAt.toISOString(),
      user: {
        id: comentario.usuario.id,
        email: '',
        name: comentario.usuario.name,
        avatar_url: comentario.usuario.avatarUrl,
        created_at: '',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[COMMENTS POST]', error);
    return NextResponse.json({ error: 'Erro ao criar comentário' }, { status: 500 });
  }
}
