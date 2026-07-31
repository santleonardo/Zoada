'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Play, Pause, Radio, Star, Music2, TrendingUp, Heart, MessageCircle, Send, ChevronLeft, ChevronRight, RadioTower } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { DEMO_TRACKS, DEMO_ARTISTS, COVER_COLORS } from '@/lib/demo-data';
import type { Track, Artist, RadioTab } from '@/types';
import CoverArt from './CoverArt';
import Equalizer from './Equalizer';
import { cn, formatNumber } from '@/lib/utils';

// Estação padrão do Zôada (sempre disponível, nunca substituída).
// ID especial que o dial usa para representar o shuffle padrão.
const DEFAULT_STATION_ID = '__default__';

const RadioScreen: React.FC = () => {
  const {
    player,
    radioEnabled,
    radioTab,
    setRadioTab,
    startRadio,
    stopRadio,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    toggleFavorite,
    toggleLike,
    selectArtist,
    selectUser,
    favorites,
    likes,
    radioComments,
    loadRadioComments,
    sendRadioComment,
    user,
    lastCountedPlay,
    queue,
    publishedStations,
    loadPublishedStations,
    selectedStationId,
    selectedStation,
    selectStation,
    advanceStationTrack,
  } = useAppStore();

  const { currentTrack, isPlaying, progress, duration } = player;
  const [search, setSearch] = useState('');
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS);
  const [artists, setArtists] = useState<Artist[]>(DEMO_ARTISTS);
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

  // Sync play counts when counted
  useEffect(() => {
    if (!lastCountedPlay) return;
    setTracks((prev) =>
      prev.map((t) => (t.id === lastCountedPlay.trackId ? { ...t, plays_count: t.plays_count + 1 } : t))
    );
  }, [lastCountedPlay]);

  // Fetch tracks, artists e estações publicadas da API
  useEffect(() => {
    fetch('/api/tracks')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.tracks) && data.tracks.length > 0) setTracks(data.tracks);
      })
      .catch(() => {});

    fetch('/api/artists')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.artists) && data.artists.length > 0) setArtists(data.artists);
      })
      .catch(() => {});

    loadPublishedStations();
  }, [loadPublishedStations]);

  // Dial: lista de estações disponíveis (padrão + publicadas)
  const dialStations = useMemo((): Array<{ id: string; name: string; subtitle?: string; cover_url?: string | null }> => {
    const list: Array<{ id: string; name: string; subtitle?: string; cover_url?: string | null }> = [
      { id: DEFAULT_STATION_ID, name: 'Rádio Zôada', subtitle: 'Shuffle infinito' },
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

  // Navega no dial
  const dialPrev = useCallback(() => {
    const prev = dialIndex <= 0 ? dialStations.length - 1 : dialIndex - 1;
    const st = dialStations[prev];
    switchToStation(st.id);
  }, [dialIndex, dialStations]);

  const dialNext = useCallback(() => {
    const next = dialIndex >= dialStations.length - 1 ? 0 : dialIndex + 1;
    const st = dialStations[next];
    switchToStation(st.id);
  }, [dialIndex, dialStations]);

  // Troca de estação: carrega a fila e ajusta o player.
  const switchToStation = useCallback(async (stationId: string) => {
    setSwitchingStation(true);
    try {
      if (stationId === DEFAULT_STATION_ID) {
        // Volta pro shuffle padrão.
        await selectStation(null);
        if (!radioEnabled || !isPlaying) {
          // Se o rádio já estava tocando, re-inicia com shuffle.
          if (radioEnabled) {
            const currentTracks = tracks.length > 0 ? tracks : DEMO_TRACKS;
            startRadio(currentTracks);
          }
        }
      } else {
        // Busca dados da estação com faixas.
        await selectStation(stationId);
        const station = useAppStore.getState().selectedStation;
        if (station?.tracks && station.tracks.length > 0) {
          const stationTracks = station.tracks;

          // Calcula qual faixa deveria estar tocando (sincronização).
          let startIndex = 0;
          if (station.current_track_started_at && station.current_track_id) {
            const startedAt = new Date(station.current_track_started_at).getTime();
            const elapsedMs = Date.now() - startedAt;
            let accumulated = 0;
            for (let i = 0; i < stationTracks.length; i++) {
              accumulated += (stationTracks[i].duration || 0) * 1000;
              if (accumulated > elapsedMs) {
                startIndex = i;
                break;
              }
              if (i === stationTracks.length - 1) startIndex = i;
            }
          }

          const startingTrack = stationTracks[startIndex];
          const state = useAppStore.getState();
          useAppStore.setState({
            radioEnabled: true,
            shuffleEnabled: false,
            repeatMode: 'all',
            queue: stationTracks,
            queueIndex: startIndex,
            shuffleBag: [],
            player: {
              ...state.player,
              currentTrack: startingTrack,
              isPlaying: true,
              progress: 0,
            },
          });
        }
      }
    } finally {
      setSwitchingStation(false);
    }
  }, [selectStation, startRadio, radioEnabled, isPlaying, tracks]);

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

  const favoriteTracks = useMemo(() => {
    return tracks.filter((t) => favorites.includes(t.id));
  }, [tracks, favorites]);

  const filteredTracks = useMemo(() => {
    if (!search) return tracks;
    const q = search.toLowerCase();
    return tracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist_name.toLowerCase().includes(q)
    );
  }, [search, tracks]);

  const filteredArtists = useMemo(() => {
    if (!search) return artists;
    const q = search.toLowerCase();
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [search, artists]);

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

  const handleToggleFavorite = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    toggleFavorite(trackId);
  };

  const handleGoToArtist = (e: React.MouseEvent, artistId: string) => {
    e.stopPropagation();
    selectArtist(artistId);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isLiked = currentTrack ? likes.some((l) => l.track_id === currentTrack.id) : false;
  const isFav = currentTrack ? favorites.includes(currentTrack.id) : false;
  const coverColors = currentTrack
    ? COVER_COLORS[currentTrack.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % COVER_COLORS.length]
    : ['#FF8C42', '#E84393'];

  // Radio queue stats
  const queueLength = queue.length;
  const currentQueueIndex = useAppStore.getState().queueIndex;

  const tabs: { key: RadioTab; label: string; icon: string }[] = [
    { key: 'faixas', label: 'Faixas', icon: '🎵' },
    { key: 'explorar', label: 'Explorar', icon: '🔍' },
    { key: 'artistas', label: 'Artistas', icon: '🎤' },
  ];

  const renderTrackRow = (track: Track, index: number) => {
    const isCurrentTrack = player.currentTrack?.id === track.id;
    const isTrackFav = favorites.includes(track.id);

    return (
      <button
        key={track.id}
        onClick={() => playTrack(track, filteredTracks)}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 active:scale-[0.98] text-left',
          isCurrentTrack
            ? 'bg-gradient-to-r from-[#FF8C42]/10 via-[#E84393]/5 to-transparent ring-1 ring-[#FF8C42]/20'
            : 'bg-white hover:bg-[#F2F2F8] shadow-sm'
        )}
      >
        {/* Track number / Equalizer */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${coverColors[0]}20, ${coverColors[1]}20)` }}
        >
          {isCurrentTrack && isPlaying ? (
            <Equalizer barCount={3} height={20} barWidth={3} gap={1.5} />
          ) : (
            <span className={cn('text-sm font-bold', isCurrentTrack ? 'text-[#FF8C42]' : 'text-black/30')}>
              {isCurrentTrack ? (
                <Play size={16} className="text-[#FF8C42] ml-0.5" fill="#FF8C42" />
              ) : (
                index + 1
              )}
            </span>
          )}
        </div>

        {/* Cover mini */}
        <div
          className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 relative"
          style={{ background: `linear-gradient(135deg, ${COVER_COLORS[(track.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % COVER_COLORS.length][0]}dd, ${COVER_COLORS[(track.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % COVER_COLORS.length][1]}dd)` }}
        >
          {track.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold truncate', isCurrentTrack ? 'text-[#FF8C42]' : 'text-[#1A1B25]')}>
            {track.title}
          </p>
          <button
            type="button"
            onClick={(e) => track.artist_id && handleGoToArtist(e, track.artist_id)}
            className="text-xs text-black/40 hover:text-[#FF8C42] hover:underline transition-colors truncate block text-left"
          >
            {track.artist_name}
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <TrendingUp size={10} className="text-black/25" />
          <span className="text-[10px] text-black/30">{formatNumber(track.plays_count)}</span>
        </div>

        {/* Favorite */}
        <button
          onClick={(e) => handleToggleFavorite(e, track.id)}
          className="p-1.5 rounded-full hover:bg-black/5 transition-colors flex-shrink-0"
          aria-label={isTrackFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Star
            size={14}
            className={cn(isTrackFav ? 'fill-[#FFD700] text-[#FFD700]' : 'text-black/20')}
          />
        </button>
      </button>
    );
  };

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
                        className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
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

      {/* Comentários gerais da rádio (chat aberto, sem vínculo com faixa) */}
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

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/25" />
          <input
            type="text"
            placeholder={`Buscar ${radioTab === 'artistas' ? 'artistas' : 'músicas'}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!pl-10 !py-2.5 !text-sm !rounded-xl"
          />
        </div>
      </div>

      {/* Radio Tabs */}
      <div className="flex gap-1.5 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setRadioTab(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 no-select',
              radioTab === tab.key
                ? 'gradient-bg text-white shadow-md shadow-[#FF8C42]/20'
                : 'bg-white text-black/40 hover:bg-black/5 hover:text-black/60 shadow-sm'
            )}
          >
            <span className="text-xs">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Faixas Tab */}
      {radioTab === 'faixas' && (
        <div className="space-y-2">
          {filteredTracks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <Music2 size={28} className="text-black/20" />
              </div>
              <p className="text-black/40 text-sm font-medium">Nenhuma faixa encontrada</p>
            </div>
          )}
          {filteredTracks.map((track, i) => renderTrackRow(track, i))}
        </div>
      )}

      {/* Explorar Tab */}
      {radioTab === 'explorar' && (
        <div className="space-y-4">
          {/* Radio stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                  <Music2 size={14} className="text-white" />
                </div>
                <span className="text-xs font-medium text-black/40">Total de faixas</span>
              </div>
              <p className="text-2xl font-bold text-[#1A1B25]">{tracks.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                  <Star size={14} className="text-white" />
                </div>
                <span className="text-xs font-medium text-black/40">Favoritadas</span>
              </div>
              <p className="text-2xl font-bold text-[#1A1B25]">{favoriteTracks.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                  <Heart size={14} className="text-white" />
                </div>
                <span className="text-xs font-medium text-black/40">Curtidas</span>
              </div>
              <p className="text-2xl font-bold text-[#1A1B25]">{likes.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                  <Radio size={14} className="text-white" />
                </div>
                <span className="text-xs font-medium text-black/40">Na fila</span>
              </div>
              <p className="text-2xl font-bold text-[#1A1B25]">{queueLength}</p>
            </div>
          </div>

          {/* Trending / Top tracks */}
          <div>
            <h2 className="text-xs font-bold text-black/60 uppercase tracking-wide mb-3">Em alta na rádio</h2>
            <div className="space-y-2">
              {[...tracks]
                .sort((a, b) => b.plays_count - a.plays_count)
                .slice(0, 5)
                .map((track, i) => {
                  const isCurrentTrack = player.currentTrack?.id === track.id;
                  const colors = COVER_COLORS[track.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % COVER_COLORS.length];
                  return (
                    <button
                      key={track.id}
                      onClick={() => playTrack(track, tracks)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 active:scale-[0.98] text-left',
                        isCurrentTrack
                          ? 'bg-gradient-to-r from-[#FF8C42]/10 via-[#E84393]/5 to-transparent ring-1 ring-[#FF8C42]/20'
                          : 'bg-white hover:bg-[#F2F2F8] shadow-sm'
                      )}
                    >
                      <div
                        className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-sm text-white"
                        style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1A1B25] truncate">{track.title}</p>
                        <p className="text-xs text-black/40 truncate">{track.artist_name}</p>
                      </div>
                      {isCurrentTrack && isPlaying && (
                        <Equalizer barCount={3} height={16} barWidth={2} gap={1} />
                      )}
                      <div className="flex items-center gap-1">
                        <TrendingUp size={10} className="text-[#FF8C42]" />
                        <span className="text-xs text-black/40">{formatNumber(track.plays_count)}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Artistas Tab */}
      {radioTab === 'artistas' && (
        <div className="space-y-3">
          {filteredArtists.map((artist) => (
            <button
              key={artist.id}
              onClick={() => selectArtist(artist.id)}
              className="w-full flex items-center gap-4 p-3 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors text-left"
            >
              <CoverArt
                title={artist.name}
                artistName={artist.genre}
                coverUrl={artist.avatar_url || artist.cover_url}
                size="sm"
                className="!w-14 !h-14 !max-w-none !rounded-xl flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1A1B25] truncate">{artist.name}</p>
                <p className="text-sm text-black/40">{artist.genre}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-black/50">{formatNumber(artist.followers_count)}</p>
                <p className="text-[10px] text-black/30">seguidores</p>
              </div>
              <div className="p-2 rounded-full bg-black/5" aria-label="Ver perfil do artista">
                <Music2 size={16} className="text-black/50" />
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

export default RadioScreen;
