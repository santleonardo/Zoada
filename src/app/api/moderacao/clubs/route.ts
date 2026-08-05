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

// GET /api/moderacao/clubs?q=termo — busca por nome do clube ou nome/email
// do criador. Sem `q`, lista os clubes mais recentes.
export async function GET(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ clubs: [] });
    }

    const { searchParams } = new URL(request.url);
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
