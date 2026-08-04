import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import type { Notification, NotificationType } from '@/types';

const TIPO_TO_TYPE: Record<string, NotificationType> = {
  SEGUIDOR: 'follow',
  SEGUIDOR_ARTISTA: 'artist_follow',
  CURTIDA_POSTAGEM: 'post_like',
  COMENTARIO_POSTAGEM: 'post_comment',
  CURTIDA_COMENTARIO: 'comment_like',
};

// GET /api/notifications                  -> lista as notificações do
//                                             usuário logado (mais recentes
//                                             primeiro) + contagem de não lidas.
// GET /api/notifications?count_only=1      -> só a contagem de não lidas,
//                                             pra polling leve do badge do
//                                             sininho sem buscar a lista inteira.
// GET /api/notifications?limit=30          -> controla quantas retornar
//                                             (padrão 30, máx 100).
export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ notifications: [], unread_count: 0 });
    }

    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get('count_only') === '1';

    const unreadCount = await db.notificacao.count({
      where: { usuarioId: userId, lida: false },
    });

    if (countOnly) {
      return NextResponse.json({ unread_count: unreadCount });
    }

    const limitParam = Number(searchParams.get('limit'));
    const limit = Math.min(Math.max(Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 30, 1), 100);

    const registros = await db.notificacao.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        ator: { select: { id: true, name: true, avatarUrl: true } },
        comentario: { select: { conteudo: true } },
        artista: { select: { id: true, nome: true } },
      },
    });

    const notifications: Notification[] = registros.map((n) => ({
      id: n.id,
      type: TIPO_TO_TYPE[n.tipo] ?? 'follow',
      read: n.lida,
      created_at: n.createdAt.toISOString(),
      actor: {
        id: n.ator.id,
        name: n.ator.name,
        avatar_url: n.ator.avatarUrl,
      },
      post_id: n.postagemId,
      comment_id: n.comentarioId,
      comment_preview: n.comentario?.conteudo ? n.comentario.conteudo.slice(0, 140) : null,
      artist_id: n.artistaId,
      artist_name: n.artista?.nome ?? null,
    }));

    return NextResponse.json({ notifications, unread_count: unreadCount });
  } catch (error) {
    console.error('[NOTIFICATIONS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar notificações' }, { status: 500 });
  }
}

// PATCH /api/notifications — marca notificações como lidas.
// body: { id: 'xxx' }  -> marca uma notificação específica (só se for do
//                          próprio usuário).
// body: { all: true }  -> marca TODAS as não lidas do usuário como lidas.
export async function PATCH(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ updated: 0 });
    }

    const body = await request.json().catch(() => ({}));

    if (body?.all === true) {
      const result = await db.notificacao.updateMany({
        where: { usuarioId: userId, lida: false },
        data: { lida: true },
      });
      return NextResponse.json({ updated: result.count });
    }

    const id = typeof body?.id === 'string' ? body.id : null;
    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório (ou envie { all: true } pra marcar todas)' },
        { status: 400 }
      );
    }

    const notificacao = await db.notificacao.findUnique({ where: { id } });
    if (!notificacao || notificacao.usuarioId !== userId) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 });
    }

    if (!notificacao.lida) {
      await db.notificacao.update({ where: { id }, data: { lida: true } });
    }

    return NextResponse.json({ updated: 1 });
  } catch (error) {
    console.error('[NOTIFICATIONS PATCH]', error);
    return NextResponse.json({ error: 'Erro ao atualizar notificações' }, { status: 500 });
  }
}
