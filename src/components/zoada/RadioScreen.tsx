'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, Radio, MessageCircle, Send, ChevronLeft, ChevronRight, RadioTower } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { DEMO_TRACKS, COVER_COLORS } from '@/lib/demo-data';
import type { Track } from '@/types';
import Equalizer from './Equalizer';
import { cn } from '@/lib/utils';

// Estação padrão do Zôada (sempre disponível, nunca substituída).
// ID especial que o dial usa para representar o shuffle padrão.
const DEFAULT_STATION_ID = '__default__';

// Tela exclusiva do sistema de Rádio: player, estação atual, dial de
// seleção de estação, informações da transmissão, chat/comentários da
// rádio. Não é responsável por descoberta de conteúdo — isso é papel da
// tela Explorar (ver ExploreScreen.tsx).
const RadioScreen: React.FC = () => {
  const {
    player,
    radioEnabled,
    startRadio,
    stopRadio,
    radioComments,
    loadRadioComments,
    sendRadioComment,
    user,
    selectUser,
    queue,
    publishedStations,
    loadPublishedStations,
    selectedStationId,
    selectedStation,
    selectStation,
    tuneIntoStation,
    advanceStationTrack,
  } = useAppStore();

  const { currentTrack, isPlaying, progress, duration } = player;
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS);
  const [newComment, setNewComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const hasAutoStarted = useRef(false);
  const [switchingStation, setSwitchingStation] = useState(false);

  // Busca o chat geral da rádio uma vez, ao entrar na tela.
  useEffect(() => {
    loadRadioComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca as faixas (usadas como fallback do shuffle padrão) e as
  // estações publicadas (usadas no dial).
  useEffect(() => {
    fetch('/api/tracks')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.tracks) && data.tracks.length > 0) setTracks(data.tracks);
      })
      .catch(() => {});

    loadPublishedStations();
  }, [loadPublishedStations]);

  // Dial: lista de estações disponíveis (padrão + publicadas)
  const dialStations = useMemo((): Array<{ id: string; name: string; subtitle?: string; cover_url?: string | null }> => {
    const list: Array<{ id: string; name: string; subtitle?: string; cover_url?: string | null }> = [
      { id: DEFAULT_STATION_ID, name: 'Rádio Zôada', subtitle: 'Shuffle infinito', cover_url: '/zoada-logo.png' },
    ];
    for (const s of publishedStations) {
      list.push({
        id: s.id,
        name: s.name,
        subtitle: s.owner?.name,
        cover_url: s.cover_url,
      });
    }
    return list;
  }, [publishedStations]);

  // Índice atual no dial (reflete selectedStationId)
  const dialIndex = useMemo(() => {
    const effectiveId = selectedStationId || DEFAULT_STATION_ID;
    const idx = dialStations.findIndex((s) => s.id === effectiveId);
    return idx >= 0 ? idx : 0;
  }, [selectedStationId, dialStations]);

  const dialStation = dialStations[dialIndex];
  const isDefaultStation = !selectedStationId;

  // Troca de estação: reaproveita a mesma action da store usada em
  // qualquer outro lugar do app (ex: card da Início, tela Explorar) pra
  // sintonizar e montar a fila/player. A estação padrão é o único caso
  // especial, já que ela não existe no servidor.
  const switchToStation = useCallback(async (stationId: string) => {
    setSwitchingStation(true);
    try {
      if (stationId === DEFAULT_STATION_ID) {
        await selectStation(null);
        if (radioEnabled) {
          const currentTracks = tracks.length > 0 ? tracks : DEMO_TRACKS;
          startRadio(currentTracks);
        }
      } else {
        await tuneIntoStation(stationId);
      }
    } finally {
      setSwitchingStation(false);
    }
  }, [selectStation, tuneIntoStation, startRadio, radioEnabled, tracks]);

  // Navega no dial
  const dialPrev = useCallback(() => {
    const prev = dialIndex <= 0 ? dialStations.length - 1 : dialIndex - 1;
    const st = dialStations[prev];
    switchToStation(st.id);
  }, [dialIndex, dialStations, switchToStation]);

  const dialNext = useCallback(() => {
    const next = dialIndex >= dialStations.length - 1 ? 0 : dialIndex + 1;
    const st = dialStations[next];
    switchToStation(st.id);
  }, [dialIndex, dialStations, switchToStation]);

  // Auto-start radio com a estação selecionada (ou default).
  useEffect(() => {
    if (hasAutoStarted.current) return;
    if (tracks.length === 0) return;

    hasAutoStarted.current = true;

    // Sempre começa com a estação padrão (shuffle).
    // Se o usuário já tinha selecionado outra estação previamente,
    // o selectStation já foi chamado e o RadioScreen renderiza com ela.
    if (!selectedStationId) {
      startRadio(tracks);
    }
  }, [tracks.length, selectedStationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quando a estação selecionada avança de faixa (fim natural), avisa
  // o servidor pra sincronizar os outros ouvintes — fire-and-forget.
  const prevTrackIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedStationId || !currentTrack) return;
    const prevId = prevTrackIdRef.current;
    prevTrackIdRef.current = currentTrack.id;
    if (prevId && prevId !== currentTrack.id) {
      advanceStationTrack();
    }
  }, [currentTrack?.id, selectedStationId, advanceStationTrack]);

  const handleSendComment = async () => {
    if (!newComment.trim() || isSendingComment) return;
    const content = newComment.trim();
    setNewComment('');
    setIsSendingComment(true);

    const ok = await sendRadioComment(content);

    setIsSendingComment(false);

    if (!ok) {
      setNewComment(content);
      toast.error('Não foi possível enviar o comentário. Tente novamente.');
    }
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const handleProgressInteraction = (clientX: number) => {
    if (!progressRef.current || duration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newProgress = (x / rect.width) * duration;
    useAppStore.getState().setProgress(newProgress);
  };

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
  }, [handleProgressInteraction]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const coverColors = currentTrack
    ? COVER_COLORS[currentTrack.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % COVER_COLORS.length]
    : ['#FF8C42', '#E84393'];

  // Radio queue stats
  const queueLength = queue.length;

  return (
    <div className="px-4 pt-4 pb-4 min-h-screen">
      {/* Radio Header */}
      <div className="relative overflow-hidden rounded-3xl p-5 mb-5">
        <div
          className="absolute inset-0"
          style={{ background: radioEnabled
            ? 'linear-gradient(135deg, #FF8C42, #E84393, #6C5CE7)'
            : 'linear-gradient(135deg, rgba(255,140,66,0.15), rgba(232,67,147,0.1), rgba(108,92,231,0.15))'
          }}
        />
        <div className="absolute inset-0 bg-black/20" />

        {/* Animated radio waves background */}
        {radioEnabled && isPlaying && (
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full border border-white/10"
                style={{
                  width: `${60 + i * 40}px`,
                  height: `${60 + i * 40}px`,
                  top: '50%',
                  left: `${75 - i * 5}%`,
                  transform: 'translate(-50%, -50%)',
                  animation: `radio-wave 2s ease-out ${i * 0.5}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg',
                radioEnabled ? 'bg-white/20 backdrop-blur-sm pulse-glow' : 'bg-white/30'
              )}>
                {isDefaultStation ? (
                  <Radio size={24} className="text-white" fill={radioEnabled ? 'white' : 'none'} />
                ) : (
                  <RadioTower size={24} className="text-white" fill="white" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {dialStation?.name || 'Rádio Zôada'}
                </h1>
                <p className="text-white/70 text-xs mt-0.5">
                  {isDefaultStation
                    ? (radioEnabled
                      ? `${queueLength} músicas em shuffle infinito`
                      : 'Toque para iniciar a rádio')
                    : (selectedStation?.owner
                      ? `Estação de ${selectedStation.owner.name} — ${queueLength} faixas`
                      : `${queueLength} faixas`)
                  }
                </p>
              </div>
            </div>

            {/* Radio ON/OFF Button */}
            <button
              onClick={() => {
                if (radioEnabled) {
                  stopRadio();
                } else if (tracks.length > 0) {
                  if (isDefaultStation) {
                    startRadio(tracks);
                  } else {
                    // Re-toca a estação selecionada.
                    switchToStation(selectedStationId!);
                  }
                }
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-300 active:scale-95',
                radioEnabled
                  ? 'bg-white text-[#FF8C42] shadow-lg shadow-white/20'
                  : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
              )}
            >
              {radioEnabled && isPlaying ? (
                <>
                  <Pause size={16} fill="#FF8C42" className="text-[#FF8C42]" />
                  <span>Parar</span>
                </>
              ) : (
                <>
                  <Play size={16} fill="white" className="text-white ml-0.5" />
                  <span>{radioEnabled ? 'Retomar' : 'Ouvir'}</span>
                </>
              )}
            </button>
          </div>

          {/* ========== STATION DIAL / SELECTOR ========== */}
          {dialStations.length > 1 && (
            <div className="mt-4">
              {/* Seletor horizontal com setas */}
              <div className="flex items-center gap-2">
                <button
                  onClick={dialPrev}
                  disabled={switchingStation}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-30 active:scale-90 flex-shrink-0"
                  aria-label="Estação anterior"
                >
                  <ChevronLeft size={16} className="text-white" />
                </button>

                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-center gap-2 px-2">
                    {switchingStation ? (
                      <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
                    ) : dialStation?.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={dialStation.cover_url}
                        alt={dialStation.name}
                        className={cn(
                          'w-10 h-10 rounded-xl flex-shrink-0',
                          dialStation.cover_url === '/zoada-logo.png'
                            ? 'object-contain bg-white/10 p-1'
                            : 'object-cover'
                        )}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Radio size={16} className="text-white/60" />
                      </div>
                    )}
                    <div className="min-w-0 text-center">
                      <p className="text-sm font-semibold text-white truncate max-w-[160px]">
                        {dialStation?.name || 'Rádio Zôada'}
                      </p>
                      {dialStation?.subtitle && (
                        <p className="text-[10px] text-white/50 truncate max-w-[160px]">
                          {dialStation.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={dialNext}
                  disabled={switchingStation}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-30 active:scale-90 flex-shrink-0"
                  aria-label="Próxima estação"
                >
                  <ChevronRight size={16} className="text-white" />
                </button>
              </div>

              {/* Indicadores de posição no dial */}
              {dialStations.length > 1 && (
                <div className="flex justify-center gap-1 mt-2">
                  {dialStations.map((st, i) => (
                    <div
                      key={st.id}
                      className={cn(
                        'w-1.5 h-1.5 rounded-full transition-all duration-300',
                        i === dialIndex
                          ? 'bg-white w-4'
                          : 'bg-white/30'
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Now Playing Mini Bar */}
          {currentTrack && (
            <div className="mt-4 p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${coverColors[0]}, ${coverColors[1]})` }}
                >
                  {currentTrack.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentTrack.cover_url} alt={currentTrack.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
                  <p className="text-xs text-white/60 truncate">{currentTrack.artist_name}</p>
                </div>
                {isPlaying && (
                  <Equalizer barCount={4} height={18} barWidth={2} gap={1} />
                )}
              </div>
              {/* Progress bar */}
              <div
                ref={progressRef}
                className="w-full h-1 bg-white/20 rounded-full mt-2.5 cursor-pointer group"
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
                  className="h-full bg-white rounded-full relative transition-[width] duration-100"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-white/40">{formatTime(progress)}</span>
                <span className="text-[10px] text-white/40">{formatTime(duration)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comentários gerais da rádio (chat aberto, sem vínculo com faixa). */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle size={16} className="text-[#FF8C42]" />
          <h3 className="text-sm font-semibold text-[#1A1B25]">
            Comentários da rádio{radioComments.length > 0 ? ` (${radioComments.length})` : ''}
          </h3>
        </div>

        <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
          {radioComments.length === 0 && (
            <p className="text-center text-black/30 text-sm py-3">
              Nenhum comentário ainda. Seja o primeiro a comentar na rádio!
            </p>
          )}
          {radioComments.map((comment) => {
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

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Comente na rádio..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
            className="!py-2.5 !text-sm"
          />
          <button
            onClick={handleSendComment}
            disabled={isSendingComment}
            className="p-2.5 rounded-xl gradient-bg flex-shrink-0 active:scale-90 transition-transform disabled:opacity-50"
            aria-label="Enviar comentário"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-32" />
    </div>
  );
};

export default RadioScreen;
