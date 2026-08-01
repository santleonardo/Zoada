import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// POST /api/post-comment-likes — Reage (ou remove a reação) de coração num
// comentário da thread de uma postagem do feed (aba "Fãs"). Toggle: se já
// tinha reagido, remove; senão, cria. Autenticado.
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

    const comentario = await db.comentarioPostagem.findUnique({ where: { id: comment_id }, select: { id: true } });
    if (!comentario) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    const existing = await db.curtidaComentarioPostagem.findUnique({
      where: {
        usuarioId_comentarioId: {
          usuarioId: userId,
          comentarioId: comment_id,
        },
      },
    });

    if (existing) {
      await db.curtidaComentarioPostagem.delete({ where: { id: existing.id } });
    } else {
      await db.curtidaComentarioPostagem.create({
        data: { usuarioId: userId, comentarioId: comment_id },
      });
    }

    const likesCount = await db.curtidaComentarioPostagem.count({ where: { comentarioId: comment_id } });

    return NextResponse.json({ liked: !existing, likes_count: likesCount });
  } catch (error) {
    console.error('[POST COMMENT LIKES POST]', error);
    return NextResponse.json({ error: 'Erro ao reagir ao comentário' }, { status: 500 });
  }
}
