'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  Heart,
  Share2,
  MoreHorizontal,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  MessageCircle,
  Send,
  Star,
  X,
  Search,
  Newspaper,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { audioEngine } from '@/lib/audioEngine';
import { toast } from 'sonner';
import { fetchConversations, sendMessageApi, searchUsers, createPost } from '@/lib/api';
import type { Conversation, User, Track } from '@/types';
import CoverArt from './CoverArt';
import Equalizer from './Equalizer';
import { cn, formatNumber } from '@/lib/utils';

const PlayerScreen: React.FC = () => {
  const {
    player, queue, queueIndex, goBack, togglePlay, nextTrack, prevTrack,
    likes, toggleLike, comments, loadComments, sendComment,
    shuffleEnabled, toggleShuffle, repeatMode, cycleRepeatMode,
    favorites, toggleFavorite, selectArtist,
    user, selectUser,
  } = useAppStore();
  const { currentTrack, isPlaying, progress, duration } = player;

  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showSendToChat, setShowSendToChat] = useState(false);
  const [showPostToFeed, setShowPostToFeed] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const isLiked = currentTrack ? likes.some((l) => l.track_id === currentTrack.id) : false;
  const isFav = currentTrack ? favorites.includes(currentTrack.id) : false;
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const trackComments = currentTrack ? comments.filter((c) => c.track_id === currentTrack.id) : [];

  // Busca os comentários reais no servidor sempre que a faixa mudar,
  // para não depender só do que já estava carregado localmente.
  useEffect(() => {
    if (currentTrack) {
      loadComments(currentTrack.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Comportamento padrão de players de música: se a faixa já passou de
  // alguns segundos, "anterior" reinicia ela do zero; só volta pra faixa
  // de fato anterior se apertado logo no começo (ou de novo em seguida).
  const handlePrevious = useCallback(() => {
    if (progress > 3) {
      audioEngine.seek(0);
    } else {
      prevTrack();
    }
  }, [progress, prevTrack]);

  // Compartilha a faixa atual: usa o share nativo do dispositivo quando
  // disponível (mobile/PWA) e cai para copiar o link no clipboard em
  // navegadores desktop que não suportam a Web Share API.
  const handleShare = useCallback(async () => {
    if (!currentTrack) return;

    const shareText = `Ouça "${currentTrack.title}" de ${currentTrack.artist_name} no Zôada`;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: currentTrack.title, text: shareText, url: shareUrl });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText} — ${shareUrl}`);
        toast.success('Link copiado para a área de transferência');
        return;
      }
      toast.error('Compartilhamento não é suportado neste navegador');
    } catch (err) {
      // Usuário cancelando o share nativo não é um erro de verdade.
      if ((err as Error)?.name !== 'AbortError') {
        toast.error('Não foi possível compartilhar');
      }
    }
  }, [currentTrack]);

  const handleProgressInteraction = useCallback(
    (clientX: number) => {
      if (!progressRef.current || duration <= 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const newProgress = (x / rect.width) * duration;
      audioEngine.seek(newProgress);
    },
    [duration]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleProgressInteraction(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) handleProgressInteraction(e.touches[0].clientX);
    };
    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, handleProgressInteraction]);

  const handleSendComment = async () => {
    if (!newComment.trim() || !currentTrack || isSendingComment) return;
    const content = newComment.trim();
    setNewComment('');
    setIsSendingComment(true);

    const ok = await sendComment(currentTrack.id, content);

    setIsSendingComment(false);

    if (!ok) {
      // Falhou de verdade — devolve o texto pro campo e avisa o usuário,
      // em vez de fingir que o comentário foi salvo.
      setNewComment(content);
      toast.error('Não foi possível enviar o comentário. Tente novamente.');
    }
  };

  if (!currentTrack) return null;

  return (
    <div className="min-h-screen flex flex-col slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 safe-top">
        <button
          onClick={goBack}
          className="p-2 rounded-full hover:bg-black/5 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={24} className="text-black/70" />
        </button>
        <div className="text-center">
          <p className="text-xs text-black/40 uppercase tracking-wider">Reproduzindo</p>
          <button
            type="button"
            onClick={() => currentTrack.artist_id && selectArtist(currentTrack.artist_id)}
            className="text-sm font-semibold text-[#1A1B25] hover:text-[#FF8C42] hover:underline transition-colors"
          >
            {currentTrack.artist_name}
          </button>
        </div>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 rounded-full hover:bg-black/5 transition-colors"
          aria-label="Mais opções"
        >
          <MoreHorizontal size={22} className="text-black/50" />
        </button>
      </div>

      {/* Cover Art - 9:16 format */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">
        <CoverArt
          title={currentTrack.title}
          artistName={currentTrack.artist_name}
          coverUrl={currentTrack.cover_url}
          size="full"
          showEqualizer
          isPlaying={isPlaying}
        />
      </div>

      {/* Track info */}
      <div className="px-6 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-xl font-bold text-[#1A1B25] truncate">{currentTrack.title}</h2>
            <button
              type="button"
              onClick={() => currentTrack.artist_id && selectArtist(currentTrack.artist_id)}
              className="text-black/50 text-sm hover:text-[#FF8C42] hover:underline transition-colors"
            >
              {currentTrack.artist_name}
            </button>
            <p className="text-black/30 text-xs mt-0.5">{formatNumber(currentTrack.plays_count)} reproduções</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => currentTrack && toggleFavorite(currentTrack.id)}
              className="p-2.5 rounded-full hover:bg-black/5 transition-all active:scale-90"
              aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Star
                size={22}
                className={cn(
                  'transition-all duration-200',
                  isFav ? 'fill-[#FFD700] text-[#FFD700] scale-110' : 'text-black/30'
                )}
              />
            </button>
            <button
              onClick={() => currentTrack && toggleLike(currentTrack.id)}
              className="p-2.5 rounded-full hover:bg-black/5 transition-all active:scale-90"
              aria-label={isLiked ? 'Descurtir' : 'Curtir'}
            >
              <Heart
                size={22}
                className={cn(
                  'transition-all duration-200',
                  isLiked ? 'fill-[#E84393] text-[#E84393] scale-110' : 'text-black/30'
                )}
              />
            </button>
            <button
              onClick={() => setShowComments(!showComments)}
              className="p-2.5 rounded-full hover:bg-black/5 transition-all active:scale-90"
              aria-label="Comentários"
            >
              <MessageCircle size={22} className="text-black/30" />
              {trackComments.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full gradient-bg text-[10px] font-bold text-white flex items-center justify-center">
                  {trackComments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowShareSheet(true)}
              className="p-2.5 rounded-full hover:bg-black/5 transition-colors active:scale-90"
              aria-label="Compartilhar"
            >
              <Share2 size={22} className="text-black/30" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 mb-3">
        <div
          ref={progressRef}
          className="w-full h-2 bg-black/10 rounded-full cursor-pointer group relative"
          onMouseDown={(e) => {
            setIsDragging(true);
            handleProgressInteraction(e.clientX);
          }}
          onTouchStart={(e) => {
            setIsDragging(true);
            handleProgressInteraction(e.touches[0].clientX);
          }}
        >
          <div
            className="h-full progress-gradient rounded-full relative transition-[width] duration-100"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full gradient-bg shadow-lg shadow-[#FF8C42]/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-black/40 font-mono">{formatTime(progress)}</span>
          <span className="text-xs text-black/40 font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 px-6 mb-6">
        <button
          onClick={toggleShuffle}
          className={cn(
            'p-2 transition-colors',
            shuffleEnabled ? 'text-[#FF8C42]' : 'text-black/30 hover:text-black/60'
          )}
          aria-label={shuffleEnabled ? 'Desativar aleatório' : 'Ativar aleatório'}
          aria-pressed={shuffleEnabled}
        >
          <Shuffle size={20} />
        </button>
        <button
          onClick={handlePrevious}
          className="p-3 rounded-full hover:bg-black/5 transition-all active:scale-90"
          aria-label="Anterior"
        >
          <SkipBack size={26} className="text-[#1A1B25]" fill="currentColor" />
        </button>
        <button
          onClick={togglePlay}
          className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center shadow-xl shadow-[#FF8C42]/30 hover:brightness-110 active:scale-90 transition-all"
          aria-label={isPlaying ? 'Pausar' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={28} className="text-white" fill="white" />
          ) : (
            <Play size={28} className="text-white ml-1" fill="white" />
          )}
        </button>
        <button
          onClick={() => nextTrack()}
          className="p-3 rounded-full hover:bg-black/5 transition-all active:scale-90"
          aria-label="Próxima"
        >
          <SkipForward size={26} className="text-[#1A1B25]" fill="currentColor" />
        </button>
        <button
          onClick={cycleRepeatMode}
          className={cn(
            'p-2 transition-colors',
            repeatMode !== 'off' ? 'text-[#FF8C42]' : 'text-black/30 hover:text-black/60'
          )}
          aria-label={
            repeatMode === 'off' ? 'Ativar repetição' :
            repeatMode === 'all' ? 'Repetir apenas esta faixa' : 'Desativar repetição'
          }
        >
          {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-black/5 bg-white slide-up" style={{ maxHeight: '40vh' }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1A1B25]">Comentários ({trackComments.length})</h3>
              <button
                onClick={() => setShowComments(false)}
                className="text-xs text-black/40 hover:text-black/60"
              >
                Fechar
              </button>
            </div>

            {/* Comments list */}
            <div className="space-y-3 mb-4 max-h-32 overflow-y-auto">
              {trackComments.length === 0 && (
                <p className="text-center text-black/30 text-sm py-4">
                  Nenhum comentário ainda. Seja o primeiro!
                </p>
              )}
              {trackComments.map((comment) => {
                const isMe = comment.user?.id === user?.id;
                const canOpenProfile = !!comment.user?.id && !isMe;
                const handleGoToUser = () => {
                  if (!canOpenProfile || !comment.user) return;
                  selectUser(comment.user.id);
                };
                return (
                  <div key={comment.id} className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleGoToUser}
                      disabled={!canOpenProfile}
                      className={cn(
                        'w-8 h-8 rounded-full bg-[#EFF0F6] flex items-center justify-center flex-shrink-0',
                        canOpenProfile && 'hover:ring-2 hover:ring-[#FF8C42] transition-shadow'
                      )}
                      aria-label={canOpenProfile ? `Ver perfil de ${comment.user?.name}` : undefined}
                    >
                      <span className="text-xs font-bold text-black/60">
                        {comment.user?.name?.charAt(0) || '?'}
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <button
                          type="button"
                          onClick={handleGoToUser}
                          disabled={!canOpenProfile}
                          className={cn(
                            'text-sm font-semibold text-[#1A1B25] text-left',
                            canOpenProfile && 'hover:text-[#FF8C42] hover:underline transition-colors'
                          )}
                        >
                          {comment.user?.name || 'Anônimo'}
                        </button>
                        <span className="text-[10px] text-black/30">
                          {new Date(comment.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-black/60 mt-0.5">{comment.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* New comment input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Adicionar comentário..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                className="!py-2.5 !text-sm"
              />
              <button
                onClick={handleSendComment}
                className="p-2.5 rounded-xl gradient-bg flex-shrink-0 active:scale-90 transition-transform"
                aria-label="Enviar"
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom spacing */}
      <div className="h-8" />

      {showShareSheet && (
        <ShareOptionsSheet
          onClose={() => setShowShareSheet(false)}
          onExternalShare={() => {
            setShowShareSheet(false);
            handleShare();
          }}
          onSendToChat={() => {
            setShowShareSheet(false);
            setShowSendToChat(true);
          }}
          onPostToFeed={() => {
            setShowShareSheet(false);
            setShowPostToFeed(true);
          }}
        />
      )}

      {showSendToChat && currentTrack && (
        <SendToChatPanel track={currentTrack} onClose={() => setShowSendToChat(false)} />
      )}

      {showPostToFeed && currentTrack && (
        <PostToFeedModal track={currentTrack} onClose={() => setShowPostToFeed(false)} />
      )}
    </div>
  );
};

export default PlayerScreen;

// Folha de opções de compartilhamento: além do share nativo/copiar link
// (comportamento antigo), agora também dá pra mandar a faixa direto numa
// conversa do app, sem precisar sair do player.
const ShareOptionsSheet: React.FC<{
  onClose: () => void;
  onExternalShare: () => void;
  onSendToChat: () => void;
  onPostToFeed: () => void;
}> = ({ onClose, onExternalShare, onSendToChat, onPostToFeed }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#F7F7FB] rounded-t-3xl safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-[#1A1B25]">Compartilhar</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} className="text-black/50" />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-2">
          <button
            onClick={onPostToFeed}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors text-left active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-full bg-[#6C5CE7] flex items-center justify-center flex-shrink-0">
              <Newspaper size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1B25]">Postar no feed</p>
              <p className="text-xs text-black/40">Compartilhar essa música no seu perfil</p>
            </div>
          </button>

          <button
            onClick={onSendToChat}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors text-left active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
              <MessageCircle size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1B25]">Enviar no chat</p>
              <p className="text-xs text-black/40">Mandar essa música numa conversa do Zôada</p>
            </div>
          </button>

          <button
            onClick={onExternalShare}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors text-left active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-full bg-[#EFF0F6] flex items-center justify-center flex-shrink-0">
              <Share2 size={18} className="text-black/50" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1B25]">Compartilhar link</p>
              <p className="text-xs text-black/40">Fora do app (WhatsApp, redes sociais, etc.)</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal de "Postar no feed": legenda opcional antes de publicar a faixa
// atual no próprio perfil. Mesma mecânica do SendToChatPanel (mostra a
// faixa no topo), só que sem escolher destinatário — vai direto pro feed
// de quem está postando.
const PostToFeedModal: React.FC<{ track: Track; onClose: () => void }> = ({ track, onClose }) => {
  const { user } = useAppStore();
  const [caption, setCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const handlePost = async () => {
    if (isPosting) return;
    if (!user) {
      toast.error('Você precisa estar logado para postar no feed.');
      return;
    }
    setIsPosting(true);
    const post = await createPost(track.id, caption.trim());
    setIsPosting(false);

    if (!post) {
      toast.error('Não foi possível postar no feed. Tente novamente.');
      return;
    }

    toast.success('Música postada no seu feed!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#F7F7FB] rounded-t-3xl safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-[#1A1B25]">Postar no feed</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} className="text-black/50" />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="flex items-center gap-3 bg-white rounded-2xl p-2.5 shadow-sm">
            <CoverArt title={track.title} artistName={track.artist_name} coverUrl={track.cover_url} size="sm" className="w-11 h-11 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1B25] truncate">{track.title}</p>
              <p className="text-xs text-black/40 truncate">{track.artist_name}</p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 280))}
            placeholder="Escreva uma legenda (opcional)..."
            rows={3}
            disabled={isPosting}
            className="w-full !py-2.5 !text-sm resize-none"
          />
          <p className="text-[11px] text-black/30 text-right mt-1">{caption.length}/280</p>
        </div>

        <div className="px-5 pb-6">
          <button
            onClick={handlePost}
            disabled={isPosting}
            className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl gradient-bg text-white font-semibold shadow-sm active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {isPosting ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Newspaper size={18} />
            )}
            Postar no feed
          </button>
        </div>
      </div>
    </div>
  );
};

// Painel de escolha de contato pra mandar a faixa atual como uma
// mensagem dentro do próprio app — mesma mecânica de "compartilhar
// música" que já existe dentro de uma conversa (ver ChatScreen), só que
// disparada a partir do player, então quem escolhe é a pessoa, não a
// música. Sem busca ativa, mostra as conversas existentes; com busca,
// procura qualquer usuário do app pra começar uma conversa nova já
// mandando a faixa.
const SendToChatPanel: React.FC<{ track: Track; onClose: () => void }> = ({ track, onClose }) => {
  const { selectConversation, navigate } = useAppStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingToId, setSendingToId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchConversations().then((convs) => {
      if (!cancelled) {
        setConversations(convs);
        setLoadingConversations(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(() => {
      searchUsers(term).then((users) => {
        setSearchResults(users);
        setSearching(false);
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleSend = async (recipientId: string, recipientName: string) => {
    if (sendingToId) return;
    setSendingToId(recipientId);
    const sent = await sendMessageApi(recipientId, '', track.id);
    setSendingToId(null);

    if (!sent) {
      toast.error('Não foi possível enviar a música. Tente novamente.');
      return;
    }

    toast.success(`Música enviada para ${recipientName}`);
    selectConversation(recipientId, recipientName);
    navigate('chat');
    onClose();
  };

  const showingSearch = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#F7F7FB] rounded-t-3xl max-h-[75vh] flex flex-col safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-[#1A1B25]">Enviar no chat</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} className="text-black/50" />
          </button>
        </div>

        {/* Faixa que está sendo compartilhada */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-3 bg-white rounded-2xl p-2.5 shadow-sm">
            <CoverArt title={track.title} artistName={track.artist_name} coverUrl={track.cover_url} size="sm" className="w-11 h-11 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1B25] truncate">{track.title}</p>
              <p className="text-xs text-black/40 truncate">{track.artist_name}</p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
            <input
              type="text"
              autoFocus
              placeholder="Buscar por nome ou e-mail..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="!pl-10 !py-2.5 !text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-2">
          {showingSearch ? (
            searching ? (
              <p className="text-center text-sm text-black/30 mt-4">Buscando...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-center text-sm text-black/30 mt-4">Nenhum usuário encontrado.</p>
            ) : (
              searchResults.map((u) => (
                <ChatContactRow
                  key={u.id}
                  name={u.name || u.email}
                  subtitle={u.email}
                  sending={sendingToId === u.id}
                  onSelect={() => handleSend(u.id, u.name || u.email)}
                />
              ))
            )
          ) : loadingConversations ? (
            <p className="text-center text-sm text-black/30 mt-4">Carregando conversas...</p>
          ) : conversations.length === 0 ? (
            <p className="text-center text-sm text-black/30 mt-4">
              Você ainda não tem conversas. Busque alguém acima pra enviar.
            </p>
          ) : (
            conversations.map((conv) => (
              <ChatContactRow
                key={conv.id}
                name={conv.other_user.name}
                subtitle="Continuar conversa"
                sending={sendingToId === conv.id}
                onSelect={() => handleSend(conv.id, conv.other_user.name)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Linha de contato reutilizada tanto pra conversas existentes quanto pra
// resultados de busca — clicar já dispara o envio da faixa.
const ChatContactRow: React.FC<{
  name: string;
  subtitle: string;
  sending: boolean;
  onSelect: () => void;
}> = ({ name, subtitle, sending, onSelect }) => (
  <button
    onClick={onSelect}
    disabled={sending}
    className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors text-left active:scale-[0.98] disabled:opacity-60"
  >
    <div className="w-10 h-10 rounded-full bg-[#EFF0F6] flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-bold text-black/60">{name.charAt(0).toUpperCase()}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-[#1A1B25] truncate">{name}</p>
      <p className="text-xs text-black/40 truncate">{subtitle}</p>
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
