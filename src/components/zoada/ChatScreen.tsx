'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, Send, ArrowLeft, MessageCircle, X, Plus, Music, Play, Pause, Flag, ShieldOff, Shield, MoreVertical, Mic, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { fetchConversations, fetchMessages, sendMessageApi, searchUsers, fetchPresence, fetchAllTracks, fetchBlockStatus, toggleBlockUser } from '@/lib/api';
import { uploadVoiceMessage } from '@/lib/trackUpload';
import { isOnline, formatLastSeen, HEARTBEAT_INTERVAL_MS } from '@/lib/presence';
import CoverArt from './CoverArt';
import Equalizer from './Equalizer';
import ReportModal from './ReportModal';
import type { Message, Conversation, User, Track } from '@/types';

const ChatScreen: React.FC = () => {
  const { selectedConversationId, selectConversation, selectUser, user } = useAppStore();
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

  // Mantém o status "online" da lista atualizado enquanto a tela estiver
  // aberta, consultando só a presença (leve) em vez de recarregar tudo.
  useEffect(() => {
    if (conversations.length === 0) return;
    const ids = conversations.map((c) => c.other_user.id);

    const refreshPresence = () => {
      fetchPresence(ids).then((presence) => {
        setConversations((prev) =>
          prev.map((c) => {
            const p = presence[c.other_user.id];
            if (!p) return c;
            return { ...c, other_user: { ...c.other_user, last_seen_at: p.last_seen_at } };
          })
        );
      });
    };

    refreshPresence();
    const interval = setInterval(refreshPresence, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);

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
            <div
              key={conv.id}
              onClick={() => selectConversation(conv.id, conv.other_user.name)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') selectConversation(conv.id, conv.other_user.name);
              }}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors w-full text-left active:scale-[0.98] cursor-pointer"
            >
              {/* Avatar — clicável, abre o perfil do usuário sem abrir a conversa */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  selectUser(conv.other_user.id);
                }}
                className="w-12 h-12 rounded-full bg-[#EFF0F6] flex items-center justify-center flex-shrink-0 relative hover:opacity-80 transition-opacity"
                aria-label={`Ver perfil de ${conv.other_user.name}`}
              >
                <span className="text-lg font-bold text-black/60">
                  {conv.other_user.name.charAt(0)}
                </span>
                {isOnline(conv.other_user.last_seen_at) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
                )}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectUser(conv.other_user.id);
                    }}
                    className="font-semibold text-[#1A1B25] text-sm truncate hover:underline text-left"
                  >
                    {conv.other_user.name}
                  </button>
                  <span className="text-[10px] text-black/30 flex-shrink-0 ml-2">
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
            </div>
          ))}
        </div>
      )}

      {/* Bottom spacing */}
      <div className="h-32" />
    </div>
  );
};

const ChatConversation: React.FC = () => {
  const { selectedConversationId, selectedConversationName, selectedConversationContext, closeConversation, selectUser, user } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [presence, setPresence] = useState<{ online: boolean; last_seen_at: string | null } | null>(null);
  const [showShareSong, setShowShareSong] = useState(false);
  const [sendingTrackId, setSendingTrackId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [iBlocked, setIBlocked] = useState(false);
  const [blockedBy, setBlockedBy] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Gravação de mensagem de voz: 'idle' (botão de mic parado), 'recording'
  // (gravando, mostra o cronômetro) ou 'uploading' (parou de gravar e está
  // subindo o áudio pro R2 antes de criar a mensagem).
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'uploading'>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingSecondsRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRecordingRef = useRef(false);

  // Duração máxima de uma mensagem de voz — ao chegar nesse limite, a
  // gravação para e é enviada automaticamente (sem precisar tocar em nada).
  const MAX_RECORDING_SECONDS = 60;

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

  // Busca e atualiza a presença real da pessoa com quem você está
  // conversando, enquanto a conversa estiver aberta.
  useEffect(() => {
    if (!selectedConversationId) return;
    let cancelled = false;

    const refreshPresence = () => {
      fetchPresence([selectedConversationId]).then((result) => {
        if (!cancelled) setPresence(result[selectedConversationId] || null);
      });
    };

    refreshPresence();
    const interval = setInterval(refreshPresence, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Status de bloqueio com essa pessoa, nos dois sentidos — usado pra
  // travar o campo de mensagem quando algum dos dois bloqueou o outro.
  useEffect(() => {
    if (!selectedConversationId) return;
    let cancelled = false;
    setIBlocked(false);
    setBlockedBy(false);
    fetchBlockStatus(selectedConversationId).then((status) => {
      if (cancelled || !status) return;
      setIBlocked(status.i_blocked);
      setBlockedBy(status.blocked_by);
    });
    return () => { cancelled = true; };
  }, [selectedConversationId]);

  const handleToggleBlock = async () => {
    if (!selectedConversationId || blockLoading) return;
    setMenuOpen(false);
    setBlockLoading(true);
    const result = await toggleBlockUser(selectedConversationId);
    setBlockLoading(false);

    if (typeof result === 'string') {
      toast.error(result);
      return;
    }
    setIBlocked(result.blocked);
    toast.success(result.blocked ? 'Usuário bloqueado.' : 'Usuário desbloqueado.');
  };

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || !selectedConversationId || sending || iBlocked || blockedBy) return;

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

  // Envia uma faixa como "link de música" clicável na conversa — o
  // destinatário poderá tocá-la sem sair do chat.
  const handleShareTrack = async (track: Track) => {
    if (!selectedConversationId || sendingTrackId) return;
    setSendingTrackId(track.id);
    const sent = await sendMessageApi(selectedConversationId, '', track.id);
    setSendingTrackId(null);

    if (!sent) return;

    setMessages((prev) => [...prev, sent]);
    setShowShareSong(false);
  };

  // Libera o microfone e para o cronômetro — chamado tanto ao cancelar
  // quanto ao terminar de gravar (com sucesso ou erro).
  const stopRecordingStreamAndTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  // Para de gravar (se estiver gravando) sem enviar nada, ao trocar de
  // conversa ou sair da tela — pra não deixar o microfone "preso" aberto.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      stopRecordingStreamAndTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  const handleStartRecording = async () => {
    if (iBlocked || blockedBy || voiceState !== 'idle') return;

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Seu navegador não suporta gravação de áudio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = preferredTypes.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.start();

      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      stoppingRecordingRef.current = false;
      setVoiceState('recording');
      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
        if (recordingSecondsRef.current >= MAX_RECORDING_SECONDS) {
          // Bateu o limite de 60s — para e envia sozinho, sem precisar
          // que o usuário toque em nada.
          handleStopAndSendRecording();
        }
      }, 1000);
    } catch {
      toast.error('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
    }
  };

  const handleCancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null; // não dispara envio nenhum, só descarta
      recorder.stop();
    }
    stopRecordingStreamAndTimer();
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;
    setVoiceState('idle');
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    stoppingRecordingRef.current = false;
  };

  const handleStopAndSendRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive' || stoppingRecordingRef.current || !selectedConversationId) return;
    stoppingRecordingRef.current = true;
    const finalSeconds = recordingSecondsRef.current;

    recorder.onstop = async () => {
      stopRecordingStreamAndTimer();
      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;

      // Gravação vazia demais (ex: soltou o dedo sem gravar nada) — não
      // vale a pena subir e criar uma mensagem quase em branco.
      if (blob.size < 500) {
        setVoiceState('idle');
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
        stoppingRecordingRef.current = false;
        return;
      }

      setVoiceState('uploading');
      try {
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voz-${Date.now()}.${ext}`, { type: mimeType });
        const url = await uploadVoiceMessage(file);
        const sent = await sendMessageApi(selectedConversationId, '', undefined, { url, duration: finalSeconds });
        if (sent) {
          setMessages((prev) => [...prev, sent]);
        } else {
          toast.error('Não foi possível enviar a mensagem de voz.');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Falha ao enviar o áudio.');
      } finally {
        setVoiceState('idle');
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
        stoppingRecordingRef.current = false;
      }
    };

    recorder.stop();
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
        <button
          onClick={() => selectUser(selectedConversationId)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
        >
          <div className="w-9 h-9 rounded-full bg-[#EFF0F6] flex items-center justify-center relative flex-shrink-0">
            <span className="text-sm font-bold text-black/60">{otherInitials}</span>
            {presence?.online && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1A1B25] truncate">{selectedConversationName}</p>
            {selectedConversationContext ? (
              <p className="text-[11px] text-black/35 truncate">
                Sobre: {selectedConversationContext}
                {presence?.online ? ' · Online' : presence ? ` · ${formatLastSeen(presence.last_seen_at)}` : ''}
              </p>
            ) : (
              <p className="text-[11px] text-black/35">
                {presence == null ? '' : presence.online ? 'Online' : formatLastSeen(presence.last_seen_at)}
              </p>
            )}
          </div>
        </button>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-full hover:bg-black/5 transition-colors"
            aria-label="Mais opções"
            title="Mais opções"
          >
            <MoreVertical size={18} className="text-black/40" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-white shadow-lg border border-black/5 py-1.5 z-20 overflow-hidden">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1A1B25] hover:bg-black/5 transition-colors text-left"
                >
                  <Flag size={15} className="text-black/40" />
                  Denunciar
                </button>
                <button
                  onClick={handleToggleBlock}
                  disabled={blockLoading}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left disabled:opacity-50"
                >
                  {iBlocked ? <Shield size={15} /> : <ShieldOff size={15} />}
                  {iBlocked ? 'Desbloquear' : 'Bloquear'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {(iBlocked || blockedBy) && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 text-center">
          <p className="text-xs text-red-600">
            {iBlocked
              ? 'Você bloqueou este usuário. Vocês não podem trocar mensagens.'
              : 'Não é possível enviar mensagens para este usuário.'}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <p className="text-center text-sm text-black/30 mt-4">Carregando mensagens...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-black/30 mt-4">Diga oi 👋</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;

            if (msg.audio_url) {
              return (
                <div
                  key={msg.id}
                  className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                >
                  <div className="max-w-[80%]">
                    <VoiceMessageBubble url={msg.audio_url} duration={msg.audio_duration} isMe={isMe} />
                    <p
                      className={cn(
                        'text-[10px] mt-1 px-1',
                        isMe ? 'text-right text-black/30' : 'text-black/30'
                      )}
                    >
                      {formatMessageTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            }

            if (msg.track) {
              return (
                <div
                  key={msg.id}
                  className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                >
                  <div className="max-w-[80%]">
                    <TrackMessageCard track={msg.track} isMe={isMe} />
                    <p
                      className={cn(
                        'text-[10px] mt-1 px-1',
                        isMe ? 'text-right text-black/30' : 'text-black/30'
                      )}
                    >
                      {formatMessageTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            }

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
        {voiceState === 'recording' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelRecording}
              className="p-3 rounded-xl bg-red-50 flex-shrink-0 active:scale-90 transition-all"
              aria-label="Cancelar gravação"
              title="Cancelar"
            >
              <Trash2 size={18} className="text-red-500" />
            </button>
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#F2F2F8]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  recordingSeconds >= MAX_RECORDING_SECONDS - 10 ? 'text-red-500' : 'text-[#1A1B25]'
                )}
              >
                {formatRecordingTime(recordingSeconds)} / {formatRecordingTime(MAX_RECORDING_SECONDS)}
              </span>
              <span className="text-xs text-black/30 ml-auto">Gravando áudio...</span>
            </div>
            <button
              onClick={handleStopAndSendRecording}
              className="p-3 rounded-xl gradient-bg flex-shrink-0 active:scale-90 transition-all"
              aria-label="Enviar mensagem de voz"
              title="Enviar"
            >
              <Send size={18} className="text-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShareSong(true)}
              disabled={iBlocked || blockedBy || voiceState === 'uploading'}
              className="p-3 rounded-xl bg-[#F2F2F8] flex-shrink-0 active:scale-90 transition-all disabled:opacity-30"
              aria-label="Compartilhar música"
              title="Compartilhar música"
            >
              <Music size={18} className="text-[#6C5CE7]" />
            </button>
            <input
              ref={inputRef}
              type="text"
              placeholder={iBlocked || blockedBy ? 'Mensagens indisponíveis' : 'Mensagem...'}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={sending || iBlocked || blockedBy || voiceState === 'uploading'}
              className="flex-1 !py-3 !text-sm"
            />
            {newMessage.trim() ? (
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending || iBlocked || blockedBy}
                className="p-3 rounded-xl gradient-bg flex-shrink-0 disabled:opacity-30 active:scale-90 transition-all"
                aria-label="Enviar"
              >
                <Send size={18} className="text-white" />
              </button>
            ) : (
              <button
                onClick={handleStartRecording}
                disabled={sending || iBlocked || blockedBy || voiceState === 'uploading'}
                className="p-3 rounded-xl gradient-bg flex-shrink-0 disabled:opacity-30 active:scale-90 transition-all"
                aria-label="Gravar mensagem de voz"
                title="Gravar áudio"
              >
                {voiceState === 'uploading' ? (
                  <div className="w-[18px] h-[18px] border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Mic size={18} className="text-white" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {showShareSong && (
        <ShareSongPanel
          onClose={() => setShowShareSong(false)}
          onShare={handleShareTrack}
          sendingTrackId={sendingTrackId}
        />
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="USUARIO"
        targetId={selectedConversationId}
      />
    </div>
  );
};

// Cartão de música clicável usado dentro do balão de chat — toca (ou
// pausa) a faixa direto pelo motor de áudio global, sem precisar sair da
// conversa nem trocar de tela.
const TrackMessageCard: React.FC<{ track: Track; isMe: boolean }> = ({ track, isMe }) => {
  const { player, playTrack, togglePlay, selectArtist } = useAppStore();
  const isCurrent = player.currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && player.isPlaying;

  const handlePlayToggle = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, [track]);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl p-2.5 pr-3',
        isMe ? 'bg-white/15' : 'bg-white shadow-sm'
      )}
    >
      <button
        onClick={handlePlayToggle}
        className="relative flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden active:scale-95 transition-transform"
        aria-label={isPlayingThis ? 'Pausar' : 'Tocar'}
      >
        <CoverArt title={track.title} artistName={track.artist_name} coverUrl={track.cover_url} size="sm" className="w-12 h-12" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          {isPlayingThis ? (
            <Equalizer barCount={3} height={16} barWidth={2} gap={2} />
          ) : (
            <Play size={16} className="text-white ml-0.5" fill="white" />
          )}
        </div>
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate', isMe ? 'text-white' : 'text-[#1A1B25]')}>
          {track.title}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (track.artist_id) selectArtist(track.artist_id);
          }}
          className={cn(
            'text-xs truncate block text-left hover:underline',
            isMe ? 'text-white/70' : 'text-black/40'
          )}
        >
          {track.artist_name}
        </button>
      </div>

      <button
        onClick={handlePlayToggle}
        className={cn(
          'p-2 rounded-full flex-shrink-0 active:scale-90 transition-all',
          isMe ? 'bg-white/20' : 'gradient-bg'
        )}
        aria-label={isPlayingThis ? 'Pausar' : 'Tocar'}
      >
        {isPlayingThis ? (
          <Pause size={14} className="text-white" fill="white" />
        ) : (
          <Play size={14} className="text-white ml-0.5" fill="white" />
        )}
      </button>
    </div>
  );
};

// Player de mensagem de voz usado dentro do balão de chat — toca/pausa o
// áudio gravado (tag <audio> própria, independente do motor de áudio
// global das músicas) e mostra uma barra de progresso simples.
const VoiceMessageBubble: React.FC<{ url: string; duration: number | null | undefined; isMe: boolean }> = ({ url, duration, isMe }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState(duration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onLoadedMetadata = () => {
      if (isFinite(audio.duration) && audio.duration > 0) setLoadedDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, []);

  const handleToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {
        // Autoplay/permissão bloqueada pelo navegador — sem tela de erro,
        // o botão só continua mostrando "play".
      });
      setIsPlaying(true);
    }
  };

  const total = loadedDuration || duration || 0;
  const progress = total > 0 ? Math.min(1, currentTime / total) : 0;
  const displaySeconds = isPlaying || currentTime > 0 ? currentTime : total;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl p-2.5 pr-3 min-w-[190px]',
        isMe ? 'bg-white/15' : 'bg-white shadow-sm'
      )}
    >
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <button
        onClick={handleToggle}
        className={cn(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all',
          isMe ? 'bg-white/20' : 'gradient-bg'
        )}
        aria-label={isPlaying ? 'Pausar' : 'Tocar'}
      >
        {isPlaying ? (
          <Pause size={14} className="text-white" fill="white" />
        ) : (
          <Play size={14} className="text-white ml-0.5" fill="white" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className={cn('h-1 rounded-full overflow-hidden', isMe ? 'bg-white/25' : 'bg-black/10')}>
          <div
            className={cn('h-full rounded-full', isMe ? 'bg-white' : 'gradient-bg')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <span className={cn('text-[11px] tabular-nums flex-shrink-0', isMe ? 'text-white/70' : 'text-black/40')}>
        {formatRecordingTime(displaySeconds)}
      </span>

      <Mic size={13} className={cn('flex-shrink-0', isMe ? 'text-white/50' : 'text-black/25')} />
    </div>
  );
};

// Painel de seleção de música pra compartilhar na conversa: mostra a
// faixa tocando agora (se houver) em destaque, e o catálogo completo logo
// abaixo pra escolher qualquer outra.
const ShareSongPanel: React.FC<{
  onClose: () => void;
  onShare: (track: Track) => void;
  sendingTrackId: string | null;
}> = ({ onClose, onShare, sendingTrackId }) => {
  const { player } = useAppStore();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchAllTracks().then((result) => {
      if (!cancelled) {
        setTracks(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const currentTrack = player.currentTrack;
  const filtered = tracks.filter((t) => {
    if (currentTrack && t.id === currentTrack.id) return false; // já aparece em destaque
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return t.title.toLowerCase().includes(q) || t.artist_name.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#F7F7FB] rounded-t-3xl max-h-[75vh] flex flex-col safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-[#1A1B25]">Compartilhar música</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} className="text-black/50" />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
            <input
              type="text"
              autoFocus
              placeholder="Buscar por música ou artista..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="!pl-10 !py-2.5 !text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-2">
          {currentTrack && (!query.trim() || currentTrack.title.toLowerCase().includes(query.trim().toLowerCase()) || currentTrack.artist_name.toLowerCase().includes(query.trim().toLowerCase())) && (
            <div>
              <p className="text-[11px] font-semibold text-black/40 uppercase tracking-wide mb-2">Tocando agora</p>
              <ShareTrackRow
                track={currentTrack}
                highlighted
                sending={sendingTrackId === currentTrack.id}
                onShare={() => onShare(currentTrack)}
              />
            </div>
          )}

          {(currentTrack || filtered.length > 0) && (
            <p className="text-[11px] font-semibold text-black/40 uppercase tracking-wide mb-2 pt-2">
              Todas as músicas
            </p>
          )}

          {loading ? (
            <p className="text-center text-sm text-black/30 mt-4">Carregando músicas...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-black/30 mt-4">
              {query.trim() ? 'Nenhuma música encontrada.' : 'Nenhuma música disponível.'}
            </p>
          ) : (
            filtered.map((track) => (
              <ShareTrackRow
                key={track.id}
                track={track}
                sending={sendingTrackId === track.id}
                onShare={() => onShare(track)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const ShareTrackRow: React.FC<{
  track: Track;
  highlighted?: boolean;
  sending: boolean;
  onShare: () => void;
}> = ({ track, highlighted, sending, onShare }) => {
  return (
    <button
      onClick={onShare}
      disabled={sending}
      className={cn(
        'w-full flex items-center gap-3 p-2.5 rounded-2xl transition-colors text-left active:scale-[0.98] disabled:opacity-50',
        highlighted ? 'bg-white shadow-sm ring-1 ring-[#6C5CE7]/20' : 'bg-white/70 hover:bg-white'
      )}
    >
      <CoverArt title={track.title} artistName={track.artist_name} coverUrl={track.cover_url} size="sm" className="w-11 h-11 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1A1B25] truncate">{track.title}</p>
        <p className="text-xs text-black/40 truncate">{track.artist_name}</p>
      </div>
      <div className="flex-shrink-0 p-2 rounded-full gradient-bg">
        {sending ? (
          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <Send size={14} className="text-white" />
        )}
      </div>
    </button>
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

function formatRecordingTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default ChatScreen;
