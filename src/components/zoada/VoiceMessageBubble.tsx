'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { cn, formatRecordingTime } from '@/lib/utils';

/**
 * Player de mensagem/postagem de voz (tag <audio> própria, independente do
 * motor de áudio global das músicas) com uma barra de progresso simples.
 * Usado tanto no balão de chat quanto no mural do clube.
 */
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
        isMe ? 'gradient-bg' : 'bg-white shadow-sm'
      )}
    >
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <button
        onClick={handleToggle}
        className={cn(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all',
          isMe ? 'bg-white/25' : 'gradient-bg'
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
        <div className={cn('h-1 rounded-full overflow-hidden', isMe ? 'bg-white/30' : 'bg-black/10')}>
          <div
            className={cn('h-full rounded-full', isMe ? 'bg-white' : 'gradient-bg')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <span className={cn('text-[11px] tabular-nums flex-shrink-0', isMe ? 'text-white/80' : 'text-black/40')}>
        {formatRecordingTime(displaySeconds)}
      </span>

      <Mic size={13} className={cn('flex-shrink-0', isMe ? 'text-white/50' : 'text-black/25')} />
    </div>
  );
};

export default VoiceMessageBubble;
