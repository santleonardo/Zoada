import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { notDeleted } from '@/lib/soft-delete';
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

    // Autenticação opcional: só usada pra marcar quais comentários o
    // usuário logado já reagiu com coração. Sem token, segue como visitante.
    const userId = await authenticateRequest(request);

    // Filtro sempre com o mesmo formato (mesmo sem usuário logado, usa um
    // id impossível) pra manter o tipo do include estável.
    const meWhere = { usuarioId: userId || '__sem_usuario__' };

    const comentarios = await db.comentarioPostagem.findMany({
      where: { postagemId: postId, ...notDeleted },
      include: {
        usuario: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { curtidas: true } },
        curtidas: { where: meWhere, select: { id: true } },
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
      likes_count: c._count.curtidas,
      liked_by_me: userId ? c.curtidas.length > 0 : null,
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
      likes_count: 0,
      liked_by_me: false,
    };

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('[POST COMMENTS POST]', error);
    return NextResponse.json({ error: 'Erro ao comentar na postagem' }, { status: 500 });
  }
}

// DELETE /api/post-comments?id=xxx — Soft-delete de um comentário próprio
// da thread. Some da thread na hora, mas fica 30 dias restaurável (PATCH
// abaixo) antes do job de limpeza apagar de vez.
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
    if (comentario.deletedAt) {
      return NextResponse.json({ error: 'Esse comentário já foi apagado' }, { status: 409 });
    }

    await db.comentarioPostagem.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ deleted: true, retention_days: 30 });
  } catch (error) {
    console.error('[POST COMMENTS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar comentário' }, { status: 500 });
  }
}

// PATCH /api/post-comments?id=xxx  body: { action: 'restore' } — Desfaz o
// soft-delete de um comentário dentro dos 30 dias (só o autor).
export async function PATCH(request: Request) {
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

    const { action } = await request.json().catch(() => ({ action: undefined }));
    if (action !== 'restore') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const comentario = await db.comentarioPostagem.findUnique({ where: { id } });
    if (!comentario) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }
    if (comentario.usuarioId !== userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    if (!comentario.deletedAt) {
      return NextResponse.json({ error: 'Esse comentário não está apagado' }, { status: 409 });
    }

    await db.comentarioPostagem.update({ where: { id }, data: { deletedAt: null } });
    return NextResponse.json({ restored: true });
  } catch (error) {
    console.error('[POST COMMENTS PATCH restore]', error);
    return NextResponse.json({ error: 'Erro ao restaurar comentário' }, { status: 500 });
  }
}
