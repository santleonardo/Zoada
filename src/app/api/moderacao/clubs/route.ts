import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MODERATION_SECRET, isNeonConfigured } from '@/lib/config';
import { notDeleted } from '@/lib/soft-delete';
import { isValidBearerSecret } from '@/lib/rateLimit';

// ============================================================
// /api/moderacao/clubs — Lista de controle dos clubes, pro painel de
// moderação conseguir enxergar todo mundo que criou clube na plataforma
// (não só quem foi denunciado) e, se precisar, excluir um clube problemático
// direto por aqui — sem depender do admin do clube fazer isso sozinho.
//
// GET    ?q=termo — busca clubes por nome ou por nome/email do criador
//                    (até 30 resultados). Sem `q`, lista os clubes mais
//                    recentes (até 100).
// GET    ?id=xxx  — acesso ao clube pelo painel: dados gerais, lista
//                    completa de membros (com email) e últimas postagens
//                    do mural — sem precisar ser membro do clube.
// DELETE ?id=xxx  — soft-delete do clube (mesma janela de 30 dias antes da
//                    limpeza automática — ver /api/cron/purge-deleted).
//                    Diferente de DELETE /api/clubs, esta rota não exige
//                    que quem chame seja o admin do clube: é a moderação
//                    agindo por cima, com a MODERATION_SECRET.
//
// Autenticação: `Authorization: Bearer <MODERATION_SECRET>`, igual ao
// resto do painel.
// ============================================================

function isModerator(request: Request): boolean {
  return isValidBearerSecret(request, MODERATION_SECRET);
}

function formatClub(c: {
  id: string;
  nome: string;
  descricao: string | null;
  capaUrl: string | null;
  criadorId: string;
  createdAt: Date;
  senhaHash: string | null;
  criador: { id: string; name: string; email: string } | null;
  _count: { membros: number; postagens: number };
}) {
  return {
    id: c.id,
    name: c.nome,
    description: c.descricao,
    cover_url: c.capaUrl,
    created_at: c.createdAt.toISOString(),
    has_password: !!c.senhaHash,
    members_count: c._count.membros,
    posts_count: c._count.postagens,
    creator: c.criador ? { id: c.criador.id, name: c.criador.name, email: c.criador.email } : null,
  };
}

function formatMember(m: {
  id: string;
  usuarioId: string;
  papel: string;
  createdAt: Date;
  usuario: { id: string; name: string; email: string; avatarUrl: string | null };
}) {
  return {
    id: m.id,
    user_id: m.usuarioId,
    name: m.usuario.name,
    email: m.usuario.email,
    avatar_url: m.usuario.avatarUrl,
    role: m.papel,
    joined_at: m.createdAt.toISOString(),
  };
}

function formatClubPost(p: {
  id: string;
  conteudo: string;
  audioUrl: string | null;
  createdAt: Date;
  usuario: { id: string; name: string };
}) {
  return {
    id: p.id,
    content: p.conteudo,
    has_audio: !!p.audioUrl,
    created_at: p.createdAt.toISOString(),
    author: { id: p.usuario.id, name: p.usuario.name },
  };
}

// GET /api/moderacao/clubs?id=xxx — acesso ao clube pelo painel: dados
// gerais + lista completa de membros (com email, pra moderação conseguir
// localizar a conta em Usuários) + últimas postagens do mural, pra dar uma
// visão geral do clube sem precisar entrar como membro.
async function getClubDetail(id: string) {
  const clube = await db.clube.findFirst({
    where: { id, ...notDeleted },
    include: {
      criador: { select: { id: true, name: true, email: true } },
      _count: { select: { membros: true, postagens: true } },
    },
  });
  if (!clube) return null;

  const [membros, postagens] = await Promise.all([
    db.membroClube.findMany({
      where: { clubeId: id, usuario: { ...notDeleted } },
      orderBy: [{ papel: 'asc' }, { createdAt: 'asc' }],
      include: { usuario: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    db.postagemClube.findMany({
      where: { clubeId: id, ...notDeleted },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { usuario: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    club: formatClub(clube),
    members: membros.map(formatMember),
    posts: postagens.map(formatClubPost),
  };
}

// GET /api/moderacao/clubs?q=termo — busca por nome do clube ou nome/email
// do criador. Sem `q`, lista os clubes mais recentes. Com `?id=xxx` em vez
// de `q`, devolve o detalhe de um clube (membros + postagens do mural).
export async function GET(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ clubs: [] });
    }

    const { searchParams } = new URL(request.url);
    const id = (searchParams.get('id') || '').trim();

    if (id) {
      const detail = await getClubDetail(id);
      if (!detail) {
        return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 });
      }
      return NextResponse.json(detail);
    }

    const q = (searchParams.get('q') || '').trim();

    const clubes = await db.clube.findMany({
      where: {
        ...notDeleted,
        ...(q
          ? {
              OR: [
                { id: q },
                { nome: { contains: q, mode: 'insensitive' } },
                { criador: { name: { contains: q, mode: 'insensitive' } } },
                { criador: { email: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: q ? 30 : 100,
      include: {
        criador: { select: { id: true, name: true, email: true } },
        _count: { select: { membros: true, postagens: true } },
      },
    });

    return NextResponse.json({ clubs: clubes.map(formatClub) });
  } catch (error) {
    console.error('[MODERACAO CLUBS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar clubes' }, { status: 500 });
  }
}

// DELETE /api/moderacao/clubs?id=xxx — soft-delete de um clube pela
// moderação (não exige ser o admin do clube).
export async function DELETE(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const existente = await db.clube.findFirst({ where: { id, ...notDeleted }, select: { id: true } });
    if (!existente) {
      return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 });
    }

    await db.clube.update({ where: { id }, data: { deletedAt: new Date() } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[MODERACAO CLUBS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao excluir clube' }, { status: 500 });
  }
}
