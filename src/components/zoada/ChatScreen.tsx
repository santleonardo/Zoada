'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Send, ArrowLeft, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { apiFetch } from '@/lib/api';
import Equalizer from './Equalizer';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/types';

const ChatScreen: React.FC = () => {
  const { selectedConversationId, selectConversation, user, goBack } = useAppStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/messages');
      if (!res.ok) {
        setConversations([]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.warn('[ChatScreen] falha ao buscar conversas:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  if (selectedConversationId) {
    return (
      <ChatConversation
        otherUserId={selectedConversationId}
        onBack={() => {
          goBack();
          // Refresh conversations list when leaving a conversation
          fetchConversations();
        }}
      />
    );
  }

  const filteredConversations = search
    ? conversations.filter((conv) =>
        conv.other_user.name.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold gradient-text">Mensagens</h1>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-foreground/50">Online</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/35" />
        <input
          type="text"
          placeholder="Buscar conversas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!pl-11"
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 size={32} className="text-foreground/25 animate-spin mb-3" />
          <p className="text-foreground/40 text-sm">Carregando conversas...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredConversations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
            <Send size={28} className="text-foreground/25" />
          </div>
          <p className="text-foreground/40 text-sm font-medium">
            {search ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
          </p>
          {!search && (
            <p className="text-foreground/30 text-xs mt-1">
              Visite o perfil de um artista e inicie uma conversa
            </p>
          )}
        </div>
      )}

      {/* Conversations list */}
      {!loading && filteredConversations.length > 0 && (
        <div className="space-y-2">
          {filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() =>
                selectConversation(conv.id, conv.other_user.name)
              }
              className="flex items-center gap-3 p-3 rounded-2xl bg-card hover:bg-secondary transition-colors w-full text-left active:scale-[0.98] shadow-sm"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 relative">
                {conv.other_user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={conv.other_user.avatar_url}
                    alt={conv.other_user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-foreground/60">
                    {conv.other_user.name.charAt(0)}
                  </span>
                )}
                <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-card" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground text-sm">
                    {conv.other_user.name}
                  </p>
                  <span className="text-[10px] text-foreground/35">
                    {formatTimeAgo(conv.last_message.created_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-sm text-foreground/40 truncate pr-2">
                    {conv.last_message.sender_id === user?.id
                      ? 'Você: '
                      : ''}
                    {conv.last_message.content}
                  </p>
                  {conv.unread_count > 0 && (
                    <div className="flex-shrink-0 w-5 h-5 rounded-full gradient-bg flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">
                        {conv.unread_count}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Bottom spacing */}
      <div className="h-32" />
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// ChatConversation — individual conversation view
// ────────────────────────────────────────────────────────────
interface ChatConversationProps {
  otherUserId: string;
  onBack: () => void;
}

const ChatConversation: React.FC<ChatConversationProps> = ({
  otherUserId,
  onBack,
}) => {
  const { selectedConversationName, user } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/messages?conversation_id=${encodeURIComponent(otherUserId)}`
      );
      if (!res.ok) {
        setMessages([]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.warn('[ChatConversation] falha ao buscar mensagens:', err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [otherUserId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;

    const content = newMessage.trim();
    setNewMessage('');

    // Optimistic: add the message locally immediately
    const optimisticMsg: Message = {
      id: `pending-${Date.now()}`,
      sender_id: user.id,
      receiver_id: otherUserId,
      content,
      read: true,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // Send to server
    setSending(true);
    try {
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiver_id: otherUserId,
          content,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Replace optimistic message with the real one from server
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMsg.id
              ? {
                  id: data.id || m.id,
                  sender_id: data.sender_id ?? m.sender_id,
                  receiver_id: data.receiver_id ?? m.receiver_id,
                  content: data.content ?? m.content,
                  read: data.read ?? m.read,
                  created_at: data.created_at ?? m.created_at,
                  sender: data.sender,
                }
              : m
          )
        );
      } else {
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setNewMessage(content); // Restore the message text
      }
    } catch (err) {
      console.warn('[ChatConversation] falha ao enviar mensagem:', err);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setNewMessage(content); // Restore the message text
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  if (!selectedConversationName) return null;

  const otherInitials = selectedConversationName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-foreground/10 glass safe-top">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-foreground/10 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} className="text-foreground/70" />
        </button>
        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <span className="text-sm font-bold text-foreground/60">
            {otherInitials}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {selectedConversationName}
          </p>
          <p className="text-[10px] text-green-400">Online agora</p>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-foreground/5">
          <Equalizer barCount={3} height={12} barWidth={2} gap={1} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 size={28} className="text-foreground/25 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center mb-3">
              <Send size={20} className="text-foreground/25" />
            </div>
            <p className="text-foreground/40 text-sm">
              Nenhuma mensagem ainda.
            </p>
            <p className="text-foreground/30 text-xs mt-1">
              Diga olá! 👋
            </p>
          </div>
        )}

        {/* Message list */}
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
                    : 'bg-card text-foreground rounded-bl-md shadow-sm'
                )}
              >
                <p className="text-sm">{msg.content}</p>
                <p
                  className={cn(
                    'text-[10px] mt-1',
                    isMe ? 'text-white/70' : 'text-foreground/40'
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
      <div className="px-4 py-3 border-t border-foreground/10 glass safe-bottom">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 !py-3 !text-sm"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="p-3 rounded-xl gradient-bg flex-shrink-0 disabled:opacity-30 active:scale-90 transition-all"
            aria-label="Enviar"
          >
            {sending ? (
              <Loader2 size={18} className="text-white animate-spin" />
            ) : (
              <Send size={18} className="text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// Utility functions
// ────────────────────────────────────────────────────────────

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
