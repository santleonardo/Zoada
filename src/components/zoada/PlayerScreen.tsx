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
  Shuffle,
  MessageCircle,
  Send,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { audioEngine } from '@/lib/audioEngine';
import { DEMO_COMMENTS } from '@/lib/demo-data';
import CoverArt from './CoverArt';
import Equalizer from './Equalizer';
import { cn } from '@/lib/utils';
import type { Comment } from '@/types';

const PlayerScreen: React.FC = () => {
  const { player, queue, queueIndex, goBack, togglePlay, nextTrack, prevTrack, likes, toggleLike, comments, addComment } = useAppStore();
  const { currentTrack, isPlaying, progress, duration } = player;

  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const isLiked = currentTrack ? likes.some((l) => l.track_id === currentTrack.id) : false;
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const trackComments = currentTrack ? comments.filter((c) => c.track_id === currentTrack.id) : [];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  const handleSendComment = () => {
    if (!newComment.trim() || !currentTrack) return;
    const user = useAppStore.getState().user;
    const comment: Comment = {
      id: `comment-${Date.now()}`,
      user_id: user?.id || '',
      track_id: currentTrack.id,
      content: newComment.trim(),
      created_at: new Date().toISOString(),
      user: user || undefined,
    };
    addComment(comment);
    setNewComment('');
  };

  if (!currentTrack) return null;

  return (
    <div className="min-h-screen flex flex-col slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 safe-top">
        <button
          onClick={goBack}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={24} className="text-white/80" />
        </button>
        <div className="text-center">
          <p className="text-xs text-white/40 uppercase tracking-wider">Reproduzindo</p>
          <p className="text-sm font-semibold text-white">{currentTrack.artist_name}</p>
        </div>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Mais opções"
        >
          <MoreHorizontal size={22} className="text-white/60" />
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
            <h2 className="text-xl font-bold text-white truncate">{currentTrack.title}</h2>
            <p className="text-white/50 text-sm">{currentTrack.artist_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => currentTrack && toggleLike(currentTrack.id)}
              className="p-2.5 rounded-full hover:bg-white/10 transition-all active:scale-90"
              aria-label={isLiked ? 'Descurtir' : 'Curtir'}
            >
              <Heart
                size={22}
                className={cn(
                  'transition-all duration-200',
                  isLiked ? 'fill-[#E84393] text-[#E84393] scale-110' : 'text-white/50'
                )}
              />
            </button>
            <button
              onClick={() => setShowComments(!showComments)}
              className="p-2.5 rounded-full hover:bg-white/10 transition-all active:scale-90"
              aria-label="Comentários"
            >
              <MessageCircle size={22} className="text-white/50" />
              {trackComments.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full gradient-bg text-[10px] font-bold text-white flex items-center justify-center">
                  {trackComments.length}
                </span>
              )}
            </button>
            <button className="p-2.5 rounded-full hover:bg-white/10 transition-colors" aria-label="Compartilhar">
              <Share2 size={22} className="text-white/50" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 mb-3">
        <div
          ref={progressRef}
          className="w-full h-2 bg-white/10 rounded-full cursor-pointer group relative"
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
          <span className="text-xs text-white/40 font-mono">{formatTime(progress)}</span>
          <span className="text-xs text-white/40 font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 px-6 mb-6">
        <button className="p-2 text-white/40 hover:text-white/70 transition-colors" aria-label="Aleatório">
          <Shuffle size={20} />
        </button>
        <button
          onClick={prevTrack}
          className="p-3 rounded-full hover:bg-white/10 transition-all active:scale-90"
          aria-label="Anterior"
        >
          <SkipBack size={26} className="text-white" fill="white" />
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
          onClick={nextTrack}
          className="p-3 rounded-full hover:bg-white/10 transition-all active:scale-90"
          aria-label="Próxima"
        >
          <SkipForward size={26} className="text-white" fill="white" />
        </button>
        <button className="p-2 text-white/40 hover:text-white/70 transition-colors" aria-label="Repetir">
          <Repeat size={20} />
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-white/5 bg-[#0F1117] slide-up" style={{ maxHeight: '40vh' }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/80">Comentários ({trackComments.length})</h3>
              <button
                onClick={() => setShowComments(false)}
                className="text-xs text-white/40 hover:text-white/60"
              >
                Fechar
              </button>
            </div>

            {/* Comments list */}
            <div className="space-y-3 mb-4 max-h-32 overflow-y-auto">
              {trackComments.length === 0 && (
                <p className="text-center text-white/30 text-sm py-4">
                  Nenhum comentário ainda. Seja o primeiro!
                </p>
              )}
              {trackComments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#252840] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white/60">
                      {comment.user?.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-white">
                        {comment.user?.name || 'Anônimo'}
                      </span>
                      <span className="text-[10px] text-white/30">
                        {new Date(comment.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm text-white/60 mt-0.5">{comment.content}</p>
                  </div>
                </div>
              ))}
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
    </div>
  );
};

export default PlayerScreen;
