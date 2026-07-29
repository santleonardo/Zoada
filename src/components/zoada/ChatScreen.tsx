'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, Send, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_CONVERSATIONS, DEMO_MESSAGES } from '@/lib/demo-data';
import Equalizer from './Equalizer';
import type { Message } from '@/types';

const ChatScreen: React.FC = () => {
  const { navigate, selectedConversationId, selectedConversationName, selectConversation, user, goBack } = useAppStore();

  if (selectedConversationId) {
    return <ChatConversation />;
  }

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
        <input type="text" placeholder="Buscar conversas..." className="!pl-11" />
      </div>

      {/* Conversations list */}
      <div className="space-y-2">
        {DEMO_CONVERSATIONS.map((conv) => (
          <button
            key={conv.id}
            onClick={() => selectConversation(conv.id, conv.other_user.name)}
            className="flex items-center gap-3 p-3 rounded-2xl bg-[#1E2030] hover:bg-[#252840] transition-colors w-full text-left active:scale-[0.98]"
          >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-[#252840] flex items-center justify-center flex-shrink-0 relative">
              <span className="text-lg font-bold text-white/60">
                {conv.other_user.name.charAt(0)}
              </span>
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

const ChatConversation: React.FC = () => {
  const { selectedConversationId, selectedConversationName, goBack, user } = useAppStore();
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const baseMessages = useMemo(() => {
    if (selectedConversationId && DEMO_MESSAGES[selectedConversationId]) {
      return DEMO_MESSAGES[selectedConversationId];
    }
    return [];
  }, [selectedConversationId]);

  const messages = [...baseMessages, ...sentMessages];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim() || !selectedConversationId) return;
    const msg: Message = {
      id: `msg-${Date.now()}`,
      sender_id: user?.id || '',
      receiver_id: selectedConversationId.replace('conv-', 'user-'),
      content: newMessage.trim(),
      read: true,
      created_at: new Date().toISOString(),
    };
    setSentMessages((prev) => [...prev, msg]);
    setNewMessage('');
    inputRef.current?.focus();
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
          onClick={() => {
            goBack();
          }}
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
            disabled={!newMessage.trim()}
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

// Utility imports
import { cn } from '@/lib/utils';

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
