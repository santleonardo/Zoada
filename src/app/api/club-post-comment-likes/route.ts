import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// POST /api/club-post-comment-likes — Reage (ou remove a reação) de
// coração num comentário da thread do mural de um clube. Toggle: se já
// tinha reagido, remove; senão, cria. Só membros do clube podem reagir.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { comment_id } = await request.json();
    if (!comment_id) {
      return NextResponse.json({ error: 'comment_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ message: 'Neon não configurado' }, { status: 503 });
    }

    const comentario = await db.comentarioPostagemClube.findUnique({
      where: { id: comment_id },
      select: { id: true, postagemClube: { select: { clubeId: true } } },
    });
    if (!comentario) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    const souMembro = await db.membroClube.findUnique({
      where: { clubeId_usuarioId: { clubeId: comentario.postagemClube.clubeId, usuarioId: userId } },
    });
    if (!souMembro) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const existing = await db.curtidaComentarioPostagemClube.findUnique({
      where: {
        usuarioId_comentarioId: {
          usuarioId: userId,
          comentarioId: comment_id,
        },
      },
    });

    if (existing) {
      await db.curtidaComentarioPostagemClube.delete({ where: { id: existing.id } });
    } else {
      await db.curtidaComentarioPostagemClube.create({
        data: { usuarioId: userId, comentarioId: comment_id },
      });
    }

    const likesCount = await db.curtidaComentarioPostagemClube.count({ where: { comentarioId: comment_id } });

    return NextResponse.json({ liked: !existing, likes_count: likesCount });
  } catch (error) {
    console.error('[CLUB POST COMMENT LIKES POST]', error);
    return NextResponse.json({ error: 'Erro ao reagir ao comentário' }, { status: 500 });
  }
}
