import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import type { Message, Conversation, Track } from '@/types';

// Monta o objeto Track (formato usado no resto do app) a partir de uma
// faixa incluída via Prisma (com o artista junto). Retorna null se a
// mensagem não tinha faixa compartilhada (ou se ela foi apagada depois).
function mapFaixaToTrack(
  faixa: null | {
    id: string;
    titulo: string;
    artistaId: string;
    coverUrl: string | null;
    audioUrl: string | null;
    duracao: number;
    playsCount: number;
    createdAt: Date;
    artista: { nome: string; avatarUrl: string | null };
  }
): Track | null {
  if (!faixa) return null;
  return {
    id: faixa.id,
    title: faixa.titulo,
    artist_id: faixa.artistaId,
    artist_name: faixa.artista.nome,
    cover_url: faixa.coverUrl || faixa.artista.avatarUrl || '',
    audio_url: faixa.audioUrl || '',
    duration: faixa.duracao,
    plays_count: faixa.playsCount,
    created_at: faixa.createdAt.toISOString(),
  };
}

// GET /api/messages?conversation_id=xxx
// GET /api/messages (no param) → returns conversations list
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationPartnerId = searchParams.get('conversation_id');

    if (!isNeonConfigured) {
      // Sem banco configurado, não há como ter conversas/mensagens reais.
      if (conversationPartnerId) {
        return NextResponse.json({ messages: [] });
      }
      return NextResponse.json({ conversations: [] });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // If conversation_id provided, return messages between current user and partner
    if (conversationPartnerId) {
      const mensagens = await db.mensagem.findMany({
        where: {
          OR: [
            { remetenteId: userId, destinatarioId: conversationPartnerId },
            { remetenteId: conversationPartnerId, destinatarioId: userId },
          ],
        },
        include: {
          remetente: { select: { id: true, name: true, avatarUrl: true } },
          faixa: { include: { artista: { select: { nome: true, avatarUrl: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const messages: Message[] = mensagens.map((m) => ({
        id: m.id,
        sender_id: m.remetenteId,
        receiver_id: m.destinatarioId,
        content: m.conteudo,
        read: m.lida,
        created_at: m.createdAt.toISOString(),
        sender: {
          id: m.remetente.id,
          email: '',
          name: m.remetente.name,
          avatar_url: m.remetente.avatarUrl,
          created_at: '',
        },
        track_id: m.faixaId,
        track: mapFaixaToTrack(m.faixa),
      }));

      // Mark unread messages as read
      await db.mensagem.updateMany({
        where: {
          remetenteId: conversationPartnerId,
          destinatarioId: userId,
          lida: false,
        },
        data: { lida: true },
      });

      return NextResponse.json({ messages });
    }

    // Return conversations list — find all users this user has chatted with
    const allMessages = await db.mensagem.findMany({
      where: {
        OR: [
          { remetenteId: userId },
          { destinatarioId: userId },
        ],
      },
      include: {
        remetente: { select: { id: true, name: true, avatarUrl: true, lastSeenAt: true } },
        destinatario: { select: { id: true, name: true, avatarUrl: true, lastSeenAt: true } },
        faixa: { include: { artista: { select: { nome: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by conversation partner and get last message
    const convMap = new Map<string, {
      otherUser: { id: string; email: string; name: string; avatar_url: string | null; last_seen_at: string | null; created_at: string };
      lastMessage: Message;
      unreadCount: number;
    }>();

    for (const m of allMessages) {
      const otherUserId = m.remetenteId === userId ? m.destinatarioId : m.remetenteId;
      const otherUser = m.remetenteId === userId ? m.destinatario : m.remetente;

      if (!convMap.has(otherUserId)) {
        convMap.set(otherUserId, {
          otherUser: {
            id: otherUser.id,
            email: '',
            name: otherUser.name,
            avatar_url: otherUser.avatarUrl,
            last_seen_at: otherUser.lastSeenAt?.toISOString() ?? null,
            created_at: '',
          },
          lastMessage: {
            id: m.id,
            sender_id: m.remetenteId,
            receiver_id: m.destinatarioId,
            // Prévia amigável na lista de conversas quando a última
            // mensagem foi uma música compartilhada (sem faixa == texto normal).
            content: m.faixa ? `🎵 ${m.faixa.titulo}` : m.conteudo,
            read: m.lida,
            created_at: m.createdAt.toISOString(),
            track_id: m.faixaId,
            track: mapFaixaToTrack(m.faixa),
          },
          unreadCount: 0,
        });
      }

      const conv = convMap.get(otherUserId)!;
      if (m.remetenteId !== userId && !m.lida) {
        conv.unreadCount++;
      }
    }

    const conversations: Conversation[] = Array.from(convMap.entries()).map(([id, conv]) => ({
      id,
      user_id: userId,
      other_user: conv.otherUser,
      last_message: conv.lastMessage,
      unread_count: conv.unreadCount,
    }));

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('[MESSAGES GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar mensagens' }, { status: 500 });
  }
}

// POST /api/messages — Send a message (authenticated)
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { receiver_id, content, track_id } = await request.json();
    // content é obrigatório normalmente, mas quando uma faixa é compartilhada
    // (track_id presente) o texto vira opcional — nesse caso preenchemos um
    // texto padrão pra manter compatibilidade com qualquer lugar que ainda
    // exiba `content` como texto puro (ex: notificações).
    if (!receiver_id || (!content && !track_id)) {
      return NextResponse.json(
        { error: 'receiver_id e (content ou track_id) são obrigatórios' },
        { status: 400 }
      );
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ message: 'Neon não configurado' }, { status: 503 });
    }

    let faixaId: string | null = null;
    let fallbackContent = content?.trim() || '';

    if (track_id) {
      // Confirma que a faixa existe antes de linkar — sem isso alguém
      // poderia mandar um track_id inventado e quebrar o cartão no chat.
      const faixa = await db.faixa.findUnique({
        where: { id: track_id },
        select: { id: true, titulo: true },
      });
      if (!faixa) {
        return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
      }
      faixaId = faixa.id;
      if (!fallbackContent) fallbackContent = `🎵 ${faixa.titulo}`;
    }

    const mensagem = await db.mensagem.create({
      data: {
        remetenteId: userId,
        destinatarioId: receiver_id,
        conteudo: fallbackContent,
        faixaId,
      },
      include: {
        remetente: { select: { id: true, name: true, avatarUrl: true } },
        faixa: { include: { artista: { select: { nome: true, avatarUrl: true } } } },
      },
    });

    return NextResponse.json({
      id: mensagem.id,
      sender_id: mensagem.remetenteId,
      receiver_id: mensagem.destinatarioId,
      content: mensagem.conteudo,
      read: mensagem.lida,
      created_at: mensagem.createdAt.toISOString(),
      sender: {
        id: mensagem.remetente.id,
        email: '',
        name: mensagem.remetente.name,
        avatar_url: mensagem.remetente.avatarUrl,
        created_at: '',
      },
      track_id: mensagem.faixaId,
      track: mapFaixaToTrack(mensagem.faixa),
    }, { status: 201 });
  } catch (error) {
    console.error('[MESSAGES POST]', error);
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 });
  }
}
