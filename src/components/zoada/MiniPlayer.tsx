'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Heart, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { audioEngine } from '@/lib/audioEngine';
import Equalizer from './Equalizer';
import { COVER_COLORS } from '@/lib/demo-data';

const MiniPlayer: React.FC = () => {
  const { player, queue, queueIndex, navigate, togglePlay, nextTrack, prevTrack, likes, toggleLike } = useAppStore();
  const { currentTrack, isPlaying, progress, duration } = player;
  const progressRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const isLiked = currentTrack ? likes.some(l => l.track_id === currentTrack.id) : false;
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const [coverFailed, setCoverFailed] = useState(false);
  useEffect(() => {
    setCoverFailed(false);
  }, [currentTrack?.cover_url]);

  const coverColors = currentTrack
    ? COVER_COLORS[
        currentTrack.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % COVER_COLORS.length
      ]
    : ['#FF8C42', '#E84393'];

  const handleProgressInteraction = useCallback((clientX: number) => {
    if (!progressRef.current || duration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newProgress = (x / rect.width) * duration;
    audioEngine.seek(newProgress);
  }, [duration]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) handleProgressInteraction(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging.current) handleProgressInteraction(e.touches[0].clientX);
    };
    const handleEnd = () => { isDragging.current = false; };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [handleProgressInteraction]);

  if (!currentTrack) return null;

  return (
    <div
      className="fixed bottom-[4rem] left-0 right-0 z-40 glass border-t border-white/5 no-select"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Progress bar at top */}
      <div
        ref={progressRef}
        className="w-full h-[2px] bg-white/10 cursor-pointer group"
        onMouseDown={(e) => {
          isDragging.current = true;
          handleProgressInteraction(e.clientX);
        }}
        onTouchStart={(e) => {
          isDragging.current = true;
          handleProgressInteraction(e.touches[0].clientX);
        }}
      >
        <div
          className="h-full progress-gradient relative transition-[width] duration-100"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full gradient-bg opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-2">
        {/* Cover art */}
        <button
          onClick={() => navigate('player')}
          className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden active:scale-95 transition-transform"
          aria-label="Abrir player"
        >
          <div
            className="w-full h-full flex items-center justify-center relative"
            style={{ background: `linear-gradient(135deg, ${coverColors[0]}, ${coverColors[1]})` }}
          >
            {currentTrack.cover_url && !coverFailed && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentTrack.cover_url}
                alt={currentTrack.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={() => setCoverFailed(true)}
              />
            )}
            <div className="relative z-10">
              {isPlaying ? (
                <Equalizer barCount={3} height={24} barWidth={3} gap={2} />
              ) : !currentTrack.cover_url || coverFailed ? (
                <span className="text-white/80 text-xs font-bold">
                  {currentTrack.artist_name.charAt(0)}
                </span>
              ) : null}
            </div>
          </div>
        </button>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
          <p className="text-xs text-white/50 truncate">{currentTrack.artist_name}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleLike(currentTrack.id)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label={isLiked ? 'Descurtir' : 'Curtir'}
          >
            <Heart
              size={18}
              className={isLiked ? 'fill-[#E84393] text-[#E84393]' : 'text-white/60'}
            />
          </button>

          <button
            onClick={prevTrack}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Anterior"
          >
            <SkipBack size={18} className="text-white/80" />
          </button>

          <button
            onClick={togglePlay}
            className="p-2.5 rounded-full gradient-bg hover:brightness-110 transition-all active:scale-90"
            aria-label={isPlaying ? 'Pausar' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={18} className="text-white" fill="white" />
            ) : (
              <Play size={18} className="text-white ml-0.5" fill="white" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Próxima"
          >
            <SkipForward size={18} className="text-white/80" />
          </button>

          <button
            onClick={() => navigate('player')}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Expandir player"
          >
            <ChevronUp size={18} className="text-white/60" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MiniPlayer;
