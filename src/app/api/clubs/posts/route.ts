import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { notDeleted } from '@/lib/soft-delete';

function formatClubPost(p: {
  id: string;
  clubeId: string;
  usuarioId: string;
  conteudo: string;
  createdAt: Date;
  usuario: { id: string; name: string; avatarUrl: string | null };
}) {
  return {
    id: p.id,
    club_id: p.clubeId,
    user_id: p.usuarioId,
    content: p.conteudo,
    created_at: p.createdAt.toISOString(),
    user: {
      id: p.usuario.id,
      name: p.usuario.name,
      avatar_url: p.usuario.avatarUrl,
    },
  };
}

// GET /api/clubs/posts?club_id=xxx — Mural do clube, mais recente
// primeiro. Só membros do clube podem ver.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubeId = searchParams.get('club_id');
    if (!clubeId) {
      return NextResponse.json({ error: 'club_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ posts: [] });
    }

    const viewerId = await authenticateRequest(request);
    if (!viewerId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const souMembro = await db.membroClube.findUnique({
      where: { clubeId_usuarioId: { clubeId, usuarioId: viewerId } },
    });
    if (!souMembro) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const postagens = await db.postagemClube.findMany({
      where: { clubeId, ...notDeleted },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { usuario: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return NextResponse.json({ posts: postagens.map(formatClubPost) });
  } catch (error) {
    console.error('[CLUB POSTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar postagens do clube' }, { status: 500 });
  }
}

// POST /api/clubs/posts — Publica uma postagem no mural do clube. Só
// membros (admin ou não) podem postar.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { club_id, content } = await request.json();
    const trimmedContent = typeof content === 'string' ? content.trim().slice(0, 280) : '';

    if (!club_id || !trimmedContent) {
      return NextResponse.json(
        { error: 'club_id e um texto são obrigatórios' },
        { status: 400 }
      );
    }

    const souMembro = await db.membroClube.findUnique({
      where: { clubeId_usuarioId: { clubeId: club_id, usuarioId: userId } },
    });
    if (!souMembro) {
      return NextResponse.json(
        { error: 'Só membros do clube podem postar' },
        { status: 403 }
      );
    }

    const postagem = await db.postagemClube.create({
      data: { clubeId: club_id, usuarioId: userId, conteudo: trimmedContent },
      include: { usuario: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return NextResponse.json({ post: formatClubPost(postagem) }, { status: 201 });
  } catch (error) {
    console.error('[CLUB POSTS POST]', error);
    return NextResponse.json({ error: 'Erro ao postar no clube' }, { status: 500 });
  }
}
