'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, Send, ArrowLeft, MessageCircle, X, Plus } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { fetchConversations, fetchMessages, sendMessageApi, searchUsers } from '@/lib/api';
import type { Message, Conversation, User } from '@/types';

const ChatScreen: React.FC = () => {
  const { selectedConversationId, selectConversation, user } = useAppStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);

  // Busca as conversas reais do usuário logado (nada de dados fake aqui).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchConversations().then((convs) => {
      if (!cancelled) {
        setConversations(convs);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (selectedConversationId) {
    return <ChatConversation />;
  }

  if (showNewChat) {
    return <NewChatSearch onClose={() => setShowNewChat(false)} />;
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold gradient-text">Mensagens</h1>
        <button
          onClick={() => setShowNewChat(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full gradient-bg text-white text-xs font-semibold active:scale-95 transition-all"
        >
          <Plus size={14} />
          Nova
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
        <input type="text" placeholder="Buscar conversas..." className="!pl-11" />
      </div>

      {/* Conversations list */}
      {loading ? (
        <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
          <p className="text-black/40 text-sm">Carregando conversas...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
          <MessageCircle size={40} className="text-black/15 mx-auto mb-3" />
          <p className="text-black/40 text-sm">Nenhuma conversa ainda</p>
          <p className="text-black/30 text-xs mt-1">Suas conversas com outros usuários aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id, conv.other_user.name)}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors w-full text-left active:scale-[0.98]"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-[#EFF0F6] flex items-center justify-center flex-shrink-0 relative">
                <span className="text-lg font-bold text-black/60">
                  {conv.other_user.name.charAt(0)}
                </span>
                <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#1A1B25] text-sm">{conv.other_user.name}</p>
                  <span className="text-[10px] text-black/30">
                    {formatTimeAgo(conv.last_message.created_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-sm text-black/40 truncate pr-2">
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
      )}

      {/* Bottom spacing */}
      <div className="h-32" />
    </div>
  );
};

const ChatConversation: React.FC = () => {
  const { selectedConversationId, selectedConversationName, closeConversation, user } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Busca o histórico real da conversa com esse usuário.
  useEffect(() => {
    if (!selectedConversationId) return;
    let cancelled = false;
    setLoading(true);
    fetchMessages(selectedConversationId).then((msgs) => {
      if (!cancelled) {
        setMessages(msgs);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || !selectedConversationId || sending) return;

    setSending(true);
    setNewMessage('');
    const sent = await sendMessageApi(selectedConversationId, content);
    setSending(false);
    inputRef.current?.focus();

    if (!sent) {
      // Falhou de verdade (rede caiu, sessão expirou, etc.) — devolve o
      // texto pro campo pra não perder o que o usuário escreveu.
      setNewMessage(content);
      return;
    }

    setMessages((prev) => [...prev, sent]);
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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5 glass safe-top">
        <button
          onClick={closeConversation}
          className="p-2 rounded-full hover:bg-black/5 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} className="text-black/70" />
        </button>
        <div className="w-9 h-9 rounded-full bg-[#EFF0F6] flex items-center justify-center">
          <span className="text-sm font-bold text-black/60">{otherInitials}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#1A1B25]">{selectedConversationName}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <p className="text-center text-sm text-black/30 mt-4">Carregando mensagens...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-black/30 mt-4">Diga oi 👋</p>
        ) : (
          messages.map((msg) => {
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
                      : 'bg-white text-[#1A1B25] shadow-sm rounded-bl-md'
                  )}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p
                    className={cn(
                      'text-[10px] mt-1',
                      isMe ? 'text-white/60' : 'text-black/30'
                    )}
                  >
                    {formatMessageTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-black/5 glass safe-bottom">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={sending}
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

// Tela de busca de usuários pra iniciar uma conversa nova — sem isso não
// havia como descobrir o id de alguém com quem você nunca tinha falado.
const NewChatSearch: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { selectConversation } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(() => {
      searchUsers(term).then((users) => {
        setResults(users);
        setSearching(false);
      });
    }, 300); // debounce pra não disparar uma busca a cada tecla
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-black/5 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} className="text-black/70" />
        </button>
        <h1 className="text-xl font-bold text-[#1A1B25]">Nova conversa</h1>
      </div>

      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
        <input
          type="text"
          autoFocus
          placeholder="Buscar por nome ou e-mail..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="!pl-11"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60"
            aria-label="Limpar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {searching ? (
        <p className="text-center text-sm text-black/30 mt-4">Buscando...</p>
      ) : !query.trim() ? (
        <p className="text-center text-sm text-black/30 mt-4">Digite um nome ou e-mail pra buscar.</p>
      ) : results.length === 0 ? (
        <p className="text-center text-sm text-black/30 mt-4">Nenhum usuário encontrado.</p>
      ) : (
        <div className="space-y-2">
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                selectConversation(u.id, u.name || u.email);
                onClose();
              }}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors w-full text-left active:scale-[0.98]"
            >
              <div className="w-11 h-11 rounded-full bg-[#EFF0F6] flex items-center justify-center flex-shrink-0">
                <span className="text-base font-bold text-black/60">
                  {(u.name || u.email).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1A1B25] text-sm truncate">{u.name || 'Sem nome'}</p>
                <p className="text-xs text-black/40 truncate">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
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
