import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// Formata uma postagem do banco (com faixa e usuário incluídos) no
// formato que o frontend espera.
function formatPost(p: {
  id: string;
  usuarioId: string;
  faixaId: string | null;
  legenda: string | null;
  createdAt: Date;
  usuario: { id: string; name: string; avatarUrl: string | null };
  faixa: {
    id: string;
    titulo: string;
    artistaId: string;
    coverUrl: string | null;
    audioUrl: string | null;
    audioUrlLow: string | null;
    duracao: number;
    playsCount: number;
    createdAt: Date;
    artista: { id: string; nome: string; avatarUrl: string | null };
  } | null;
}) {
  return {
    id: p.id,
    user_id: p.usuarioId,
    track_id: p.faixaId,
    content: p.legenda,
    created_at: p.createdAt.toISOString(),
    user: {
      id: p.usuario.id,
      name: p.usuario.name,
      avatar_url: p.usuario.avatarUrl,
    },
    track: p.faixa
      ? {
          id: p.faixa.id,
          title: p.faixa.titulo,
          artist_id: p.faixa.artistaId,
          artist_name: p.faixa.artista.nome,
          cover_url: p.faixa.coverUrl || p.faixa.artista.avatarUrl || null,
          audio_url: p.faixa.audioUrl,
          audio_url_low: p.faixa.audioUrlLow,
          duration: p.faixa.duracao,
          plays_count: p.faixa.playsCount,
          created_at: p.faixa.createdAt.toISOString(),
        }
      : null,
  };
}

const postInclude = {
  faixa: {
    include: {
      artista: { select: { id: true, nome: true, avatarUrl: true } },
    },
  },
  usuario: { select: { id: true, name: true, avatarUrl: true } },
} as const;

// GET /api/posts?user_id=xxx  -> postagens de UM usuário (feed do perfil dele).
// GET /api/posts              -> feed geral (postagens mais recentes de TODOS
//                                 os usuários), usado na aba "Fãs".
// Público em ambos os casos — não exige login, igual ao resto do perfil.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const limitParam = parseInt(searchParams.get('limit') || '', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 30;

    if (!isNeonConfigured) {
      return NextResponse.json({ posts: [] });
    }

    const postagens = await db.postagem.findMany({
      where: userId ? { usuarioId: userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: userId ? undefined : limit,
      include: postInclude,
    });

    return NextResponse.json({ posts: postagens.map(formatPost) });
  } catch (error) {
    console.error('[POSTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar postagens' }, { status: 500 });
  }
}

// POST /api/posts — Cria uma postagem no feed do usuário logado. Precisa
// de pelo menos um dos dois: track_id (compartilhar uma música, com
// legenda/conteúdo opcional) ou content (post livre, só texto).
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { track_id, content } = await request.json();
    const trimmedContent = typeof content === 'string' ? content.trim().slice(0, 280) : '';

    if (!track_id && !trimmedContent) {
      return NextResponse.json(
        { error: 'A postagem precisa de uma música ou de um texto' },
        { status: 400 }
      );
    }

    if (track_id) {
      const faixaExiste = await db.faixa.findUnique({ where: { id: track_id }, select: { id: true } });
      if (!faixaExiste) {
        return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
      }
    }

    const postagem = await db.postagem.create({
      data: {
        usuarioId: userId,
        faixaId: track_id || null,
        legenda: trimmedContent || null,
      },
      include: postInclude,
    });

    return NextResponse.json({ post: formatPost(postagem) }, { status: 201 });
  } catch (error) {
    console.error('[POSTS POST]', error);
    return NextResponse.json({ error: 'Erro ao postar' }, { status: 500 });
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
