import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// GET /api/posts?user_id=xxx  -> postagens (músicas compartilhadas no feed)
//                                 de UM usuário, mais recente primeiro.
//                                 Público: não exige login pra ver o feed
//                                 de alguém (é uma vitrine, como o perfil).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ posts: [] });
    }

    const postagens = await db.postagem.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        faixa: {
          include: {
            artista: { select: { id: true, nome: true, avatarUrl: true } },
          },
        },
        usuario: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const posts = postagens.map((p) => ({
      id: p.id,
      user_id: p.usuarioId,
      track_id: p.faixaId,
      caption: p.legenda,
      created_at: p.createdAt.toISOString(),
      user: {
        id: p.usuario.id,
        name: p.usuario.name,
        avatar_url: p.usuario.avatarUrl,
      },
      track: {
        id: p.faixa.id,
        title: p.faixa.titulo,
        artist_id: p.faixa.artistaId,
        artist_name: p.faixa.artista.nome,
        cover_url: p.faixa.coverUrl || p.faixa.artista.avatarUrl || null,
        audio_url: p.faixa.audioUrl,
        duration: p.faixa.duracao,
        plays_count: p.faixa.playsCount,
        created_at: p.faixa.createdAt.toISOString(),
      },
    }));

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('[POSTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar postagens' }, { status: 500 });
  }
}

// POST /api/posts — Posta uma faixa no feed do usuário logado, com
// legenda opcional. Uma mesma faixa pode ser postada mais de uma vez
// (cada postagem é independente, como um "repost" novo).
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { track_id, caption } = await request.json();
    if (!track_id) {
      return NextResponse.json({ error: 'track_id é obrigatório' }, { status: 400 });
    }

    const faixa = await db.faixa.findUnique({
      where: { id: track_id },
      include: { artista: { select: { id: true, nome: true, avatarUrl: true } } },
    });
    if (!faixa) {
      return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
    }

    const trimmedCaption = typeof caption === 'string' ? caption.trim().slice(0, 280) : '';

    const postagem = await db.postagem.create({
      data: {
        usuarioId: userId,
        faixaId: track_id,
        legenda: trimmedCaption || null,
      },
    });

    const usuario = await db.usuario.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true },
    });

    return NextResponse.json({
      post: {
        id: postagem.id,
        user_id: postagem.usuarioId,
        track_id: postagem.faixaId,
        caption: postagem.legenda,
        created_at: postagem.createdAt.toISOString(),
        user: usuario
          ? { id: usuario.id, name: usuario.name, avatar_url: usuario.avatarUrl }
          : null,
        track: {
          id: faixa.id,
          title: faixa.titulo,
          artist_id: faixa.artistaId,
          artist_name: faixa.artista.nome,
          cover_url: faixa.coverUrl || faixa.artista.avatarUrl || null,
          audio_url: faixa.audioUrl,
          duration: faixa.duracao,
          plays_count: faixa.playsCount,
          created_at: faixa.createdAt.toISOString(),
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[POSTS POST]', error);
    return NextResponse.json({ error: 'Erro ao postar no feed' }, { status: 500 });
  }
}

// DELETE /api/posts?id=xxx — Remove uma postagem própria (só o dono pode apagar).
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

    const postagem = await db.postagem.findUnique({ where: { id } });
    if (!postagem) {
      return NextResponse.json({ error: 'Postagem não encontrada' }, { status: 404 });
    }
    if (postagem.usuarioId !== userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    await db.postagem.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[POSTS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar postagem' }, { status: 500 });
  }
}
