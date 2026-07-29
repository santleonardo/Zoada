'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ArrowLeft, Send, MessageCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { apiFetch } from '@/lib/api';
import Equalizer from './Equalizer';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/types';

const ChatScreen: React.FC = () => {
  const { selectedConversationId } = useAppStore();

  if (selectedConversationId) {
    return <ChatConversation />;
  }

  return <ConversationList />;
};

// ─── Conversations List ────────────────────────────────────────

const ConversationList: React.FC = () => {
  const { selectConversation, user } = useAppStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiFetch('/api/messages');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // API indisponível
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const filtered = search
    ? conversations.filter((c) =>
        c.other_user.name.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold gradient-text">Mensagens</h1>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-white/50">Online</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Buscar conversas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!pl-11"
        />
      </div>

      {/* Conversations list */}
      <div className="space-y-2">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-[#FF8C42] animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <MessageCircle size={28} className="text-white/20" />
            </div>
            <p className="text-white/40 text-sm font-medium">Nenhuma conversa ainda</p>
            <p className="text-white/25 text-xs mt-1 text-center">
              Quando você trocar mensagens com outros usuários, as conversas aparecerão aqui.
            </p>
          </div>
        )}

        {filtered.map((conv) => (
          <button
            key={conv.id}
            onClick={() => selectConversation(conv.id, conv.other_user.name)}
            className="flex items-center gap-3 p-3 rounded-2xl bg-[#1E2030] hover:bg-[#252840] transition-colors w-full text-left active:scale-[0.98]"
          >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-[#252840] flex items-center justify-center flex-shrink-0 relative">
              {conv.other_user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={conv.other_user.avatar_url}
                  alt={conv.other_user.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-white/60">
                  {conv.other_user.name.charAt(0)}
                </span>
              )}
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-[#1E2030]" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white text-sm">{conv.other_user.name}</p>
                <span className="text-[10px] text-white/30">
                  {formatTimeAgo(conv.last_message.created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-sm text-white/40 truncate pr-2">
                  {conv.last_message.sender_id === user?.id ? 'Você: ' : ''}
                  {conv.last_message.content}
                </p>
                {conv.unread_count > 0 && (
                  <div className="flex-shrink-0 w-5 h-5 rounded-full gradient-bg flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{conv.unread_count}</span>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Bottom spacing */}
      <div className="h-32" />
    </div>
  );
};

// ─── Conversation (messages) ──────────────────────────────────

const ChatConversation: React.FC = () => {
  const { selectedConversationId, selectedConversationName, goBack, user } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!selectedConversationId) return;
    try {
      const res = await apiFetch(`/api/messages?conversation_id=${encodeURIComponent(selectedConversationId)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // ignore
    }
  }, [selectedConversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversationId || sending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiver_id: selectedConversationId,
          content,
        }),
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
      }
    } catch {
      // erro silencioso
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  if (!selectedConversationId) return null;

  const otherInitials = selectedConversationName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 glass safe-top">
        <button
          onClick={goBack}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} className="text-white/80" />
        </button>
        <div className="w-9 h-9 rounded-full bg-[#252840] flex items-center justify-center">
          <span className="text-sm font-bold text-white/60">{otherInitials}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{selectedConversationName}</p>
          <p className="text-[10px] text-green-400">Online agora</p>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5">
          <Equalizer barCount={3} height={12} barWidth={2} gap={1} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/25 text-sm">Nenhuma mensagem ainda. Diga olá! 👋</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5',
                  isMe
                    ? 'gradient-bg text-white rounded-br-md'
                    : 'bg-[#1E2030] text-white rounded-bl-md'
                )}
              >
                <p className="text-sm">{msg.content}</p>
                <p
                  className={cn(
                    'text-[10px] mt-1',
                    isMe ? 'text-white/50' : 'text-white/30'
                  )}
                >
                  {formatMessageTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/5 glass safe-bottom">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 !py-3 !text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="p-3 rounded-xl gradient-bg flex-shrink-0 disabled:opacity-30 active:scale-90 transition-all"
            aria-label="Enviar"
          >
            <Send size={18} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Utilities ─────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default ChatScreen;
