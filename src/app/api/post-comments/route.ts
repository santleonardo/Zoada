import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import type { PostComment } from '@/types';

// GET /api/post-comments?post_id=xxx — thread de comentários de uma
// postagem do feed (público, igual ao resto do feed).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('post_id');

    if (!postId) {
      return NextResponse.json({ error: 'post_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ comments: [] });
    }

    const comentarios = await db.comentarioPostagem.findMany({
      where: { postagemId: postId },
      include: {
        usuario: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const comments: PostComment[] = comentarios.map((c) => ({
      id: c.id,
      user_id: c.usuarioId,
      post_id: c.postagemId,
      content: c.conteudo,
      created_at: c.createdAt.toISOString(),
      user: {
        id: c.usuario.id,
        name: c.usuario.name,
        avatar_url: c.usuario.avatarUrl,
      },
    }));

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('[POST COMMENTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar comentários da postagem' }, { status: 500 });
  }
}

// POST /api/post-comments — Adiciona um comentário numa postagem do feed
// (autenticado).
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { post_id, content } = await request.json();
    const trimmed = typeof content === 'string' ? content.trim().slice(0, 500) : '';

    if (!post_id || !trimmed) {
      return NextResponse.json({ error: 'post_id e content são obrigatórios' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const postagem = await db.postagem.findUnique({ where: { id: post_id }, select: { id: true } });
    if (!postagem) {
      return NextResponse.json({ error: 'Postagem não encontrada' }, { status: 404 });
    }

    const comentario = await db.comentarioPostagem.create({
      data: {
        usuarioId: userId,
        postagemId: post_id,
        conteudo: trimmed,
      },
      include: {
        usuario: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const comment: PostComment = {
      id: comentario.id,
      user_id: comentario.usuarioId,
      post_id: comentario.postagemId,
      content: comentario.conteudo,
      created_at: comentario.createdAt.toISOString(),
      user: {
        id: comentario.usuario.id,
        name: comentario.usuario.name,
        avatar_url: comentario.usuario.avatarUrl,
      },
    };

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('[POST COMMENTS POST]', error);
    return NextResponse.json({ error: 'Erro ao comentar na postagem' }, { status: 500 });
  }
}

// DELETE /api/post-comments?id=xxx — Remove um comentário próprio da thread.
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
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const comentario = await db.comentarioPostagem.findUnique({ where: { id } });
    if (!comentario) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }
    if (comentario.usuarioId !== userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    await db.comentarioPostagem.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[POST COMMENTS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar comentário' }, { status: 500 });
  }
}
