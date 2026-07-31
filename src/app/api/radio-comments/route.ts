import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { DEMO_RADIO_COMMENTS } from '@/lib/demo-data';
import type { RadioComment } from '@/types';

const MAX_COMMENTS = 100;

// GET /api/radio-comments — chat geral da rádio (não depende de track_id)
export async function GET() {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ comments: DEMO_RADIO_COMMENTS });
    }

    const comentarios = await db.comentarioRadio.findMany({
      include: {
        usuario: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_COMMENTS,
    });

    // Vem do banco em ordem decrescente (mais recente primeiro) por causa
    // do `take`, mas o chat exibe do mais antigo pro mais novo.
    const comments: RadioComment[] = comentarios
      .reverse()
      .map((c) => ({
        id: c.id,
        user_id: c.usuarioId,
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
    console.error('[RADIO COMMENTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar comentários da rádio' }, { status: 500 });
  }
}

// POST /api/radio-comments — Adiciona um comentário geral (autenticado)
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { content } = await request.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'content é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ message: 'Neon não configurado' }, { status: 503 });
    }

    const comentario = await db.comentarioRadio.create({
      data: {
        usuarioId: userId,
        conteudo: content.trim(),
      },
      include: {
        usuario: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({
      id: comentario.id,
      user_id: comentario.usuarioId,
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
    console.error('[RADIO COMMENTS POST]', error);
    return NextResponse.json({ error: 'Erro ao criar comentário da rádio' }, { status: 500 });
  }
}
