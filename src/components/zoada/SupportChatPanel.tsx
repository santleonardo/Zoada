'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, ChevronDown, Send, Loader2 } from 'lucide-react';
import { fetchSupportMessages, sendSupportMessage, type SupportMessage } from '@/lib/api';

// Intervalo de atualização automática enquanto o painel está aberto —
// mesma ideia da presença no chat entre usuários, só que mais espaçado
// (não é algo que precisa parecer "tempo real" segundo a segundo).
const POLL_INTERVAL_MS = 15000;

/**
 * Canal de mensagens do usuário com a Moderação, dentro do próprio painel
 * do usuário (Perfil). É uma thread única (tipo "fale conosco"): dúvidas,
 * apelar de uma denúncia, pedir ajuda com a conta, etc. — diferente do
 * botão "Denunciar", que é sobre um conteúdo específico.
 *
 * Do outro lado dessa conversa está o painel externo em
 * public/moderacao/index.html, que lê/responde pela mesma rota
 * (/api/moderacao/mensagens) autenticado com MODERATION_SECRET.
 */
const SupportChatPanel: React.FC = () => {
  // Seção fechada por padrão, segue o mesmo padrão dos outros painéis do perfil.
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const unreadCount = messages.filter((m) => m.remetente === 'MODERADOR' && !m.lida_pelo_usuario).length;

  const loadMessages = useCallback(async () => {
    const msgs = await fetchSupportMessages();
    setMessages(msgs);
    setLoadedOnce(true);
  }, []);

  // Busca a thread ao abrir o painel pela primeira vez.
  useEffect(() => {
    if (!isOpen || loadedOnce) return;
    setLoading(true);
    loadMessages().finally(() => setLoading(false));
  }, [isOpen, loadedOnce, loadMessages]);

  // Enquanto o painel estiver aberto, confere periodicamente se a
  // moderação respondeu — sem isso o usuário só veria uma resposta nova
  // recarregando a página inteira.
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(loadMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOpen, loadMessages]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || sending) return;

    setSending(true);
    setNewMessage('');
    const sent = await sendSupportMessage(content);
    setSending(false);

    if (!sent) {
      // Falhou de verdade (rede caiu, sessão expirou) — devolve o texto
      // pro campo pra não perder o que o usuário escreveu.
      setNewMessage(content);
      return;
    }

    setMessages((prev) => [...prev, sent]);
  };

  return (
    <div className="rounded-2xl bg-white shadow-sm p-5 mb-6">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#6C5CE7]" />
          <h3 className="text-lg font-semibold text-[#1A1B25]">Fale com a Moderação</h3>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <div className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full gradient-bg flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{unreadCount}</span>
            </div>
          )}
          <ChevronDown
            size={18}
            className={`text-black/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="mt-4">
          <p className="text-xs text-black/40 mb-4">
            Dúvidas, problemas com a conta ou quer contestar uma denúncia? Mande uma mensagem
            direto pra equipe de moderação por aqui.
          </p>

          {/* Histórico de mensagens */}
          <div className="rounded-xl bg-[#F7F7FB] p-3 mb-3 max-h-80 overflow-y-auto space-y-2">
            {loading ? (
              <p className="text-center text-sm text-black/30 py-6">Carregando conversa...</p>
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-black/30 py-6">
                Nenhuma mensagem ainda. Manda um oi pra equipe! 👋
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.remetente === 'USUARIO' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm ${
                      m.remetente === 'USUARIO'
                        ? 'gradient-bg text-white rounded-br-sm'
                        : 'bg-white shadow-sm text-[#1A1B25] rounded-bl-sm'
                    }`}
                  >
                    {m.remetente === 'MODERADOR' && (
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#6C5CE7] mb-0.5">
                        Moderação
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                    <p
                      className={`text-[10px] mt-1 ${
                        m.remetente === 'USUARIO' ? 'text-white/70' : 'text-black/30'
                      }`}
                    >
                      {formatMessageTime(m.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Campo de envio */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escreva sua mensagem..."
              maxLength={2000}
              disabled={sending}
              className="flex-1 !py-2.5 !text-sm"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="flex-shrink-0 w-10 h-10 rounded-full gradient-bg flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95"
              aria-label="Enviar mensagem"
            >
              {sending ? (
                <Loader2 size={16} className="text-white animate-spin" />
              ) : (
                <Send size={16} className="text-white" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default SupportChatPanel;
