import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import type { Message, Conversation } from '@/types';

// GET /api/messages?conversation_id=xxx
// GET /api/messages (no param) → returns conversations list
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationPartnerId = searchParams.get('conversation_id');

    if (!isNeonConfigured) {
      // No database configured — return empty data
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
        remetente: { select: { id: true, name: true, avatarUrl: true } },
        destinatario: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by conversation partner and get last message
    const convMap = new Map<string, {
      otherUser: { id: string; email: string; name: string; avatar_url: string | null; created_at: string };
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
            created_at: '',
          },
          lastMessage: {
            id: m.id,
            sender_id: m.remetenteId,
            receiver_id: m.destinatarioId,
            content: m.conteudo,
            read: m.lida,
            created_at: m.createdAt.toISOString(),
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
    if (!isNeonConfigured) {
      return NextResponse.json(
        { error: 'Banco de dados não configurado. Não é possível enviar mensagens.' },
        { status: 503 }
      );
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { receiver_id, content } = await request.json();
    if (!receiver_id || !content) {
      return NextResponse.json(
        { error: 'receiver_id e content são obrigatórios' },
        { status: 400 }
      );
    }

    const mensagem = await db.mensagem.create({
      data: {
        remetenteId: userId,
        destinatarioId: receiver_id,
        conteudo: content,
      },
      include: {
        remetente: { select: { id: true, name: true, avatarUrl: true } },
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
    }, { status: 201 });
  } catch (error) {
    console.error('[MESSAGES POST]', error);
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 });
  }
}
