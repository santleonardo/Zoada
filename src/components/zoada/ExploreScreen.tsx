'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Play, Music2, TrendingUp, RadioTower, Users, Star } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_TRACKS, DEMO_ARTISTS, COVER_COLORS } from '@/lib/demo-data';
import { searchUsers } from '@/lib/api';
import type { Track, Artist, UserSearchResult } from '@/types';
import CoverArt from './CoverArt';
import Equalizer from './Equalizer';
import { cn, formatNumber } from '@/lib/utils';

// Sub-seção ativa dentro da tela Explorar. Explorar é o hub geral de
// descoberta de conteúdo do app, dividido nessas 4 categorias — igual a
// apps modernos de streaming/redes sociais (músicas, estações, artistas,
// usuários). Não tem relação com o player de rádio em si.
type ExploreSection = 'musicas' | 'estacoes' | 'artistas' | 'usuarios';

const ExploreScreen: React.FC = () => {
  const {
    player,
    playTrack,
    toggleFavorite,
    favorites,
    selectArtist,
    selectUser,
    user,
    publishedStations,
    loadPublishedStations,
    tuneIntoStation,
    selectStation,
    startRadio,
    radioEnabled,
    navigate,
  } = useAppStore();

  const [search, setSearch] = useState('');
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS);
  const [artists, setArtists] = useState<Artist[]>(DEMO_ARTISTS);
  const [exploreSection, setExploreSection] = useState<ExploreSection>('musicas');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Busca músicas, artistas e estações publicadas assim que a tela abre —
  // dados próprios da tela Explorar, independentes do estado da Rádio.
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

  // Busca usuários por nome quando a sub-seção "Usuários" está ativa — com
  // um pequeno debounce pra não disparar uma chamada a cada tecla digitada.
  useEffect(() => {
    if (exploreSection !== 'usuarios') return;
    if (!search.trim()) {
      setUserResults([]);
      setIsSearchingUsers(false);
      return;
    }
    setIsSearchingUsers(true);
    const timeout = setTimeout(() => {
      searchUsers(search)
        .then(setUserResults)
        .finally(() => setIsSearchingUsers(false));
    }, 350);
    return () => clearTimeout(timeout);
  }, [exploreSection, search]);

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

  const filteredStations = useMemo(() => {
    if (!search) return publishedStations;
    const q = search.toLowerCase();
    return publishedStations.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.owner?.name || '').toLowerCase().includes(q)
    );
  }, [search, publishedStations]);

  // Sintoniza a estação escolhida (reaproveitando a mesma action da store
  // usada no dial da Rádio e no ranking da Início) e leva o usuário pra
  // tela de Rádio, que é quem cuida de fato da reprodução.
  const DEFAULT_STATION_ID = '__default__';
  const handlePlayStation = (stationId: string) => {
    if (stationId === DEFAULT_STATION_ID) {
      selectStation(null);
      if (!radioEnabled) startRadio(tracks.length > 0 ? tracks : DEMO_TRACKS);
    } else {
      tuneIntoStation(stationId);
    }
    navigate('radio');
  };

  const handleToggleFavorite = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    toggleFavorite(trackId);
  };

  const handleGoToArtist = (e: React.MouseEvent, artistId: string) => {
    e.stopPropagation();
    selectArtist(artistId);
  };

  const renderTrackRow = (track: Track, index: number) => {
    const isCurrentTrack = player.currentTrack?.id === track.id;
    const isTrackFav = favorites.includes(track.id);
    const coverColors = COVER_COLORS[(track.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % COVER_COLORS.length];

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
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${coverColors[0]}20, ${coverColors[1]}20)` }}
        >
          {isCurrentTrack && player.isPlaying ? (
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

        <div
          className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 relative"
          style={{ background: `linear-gradient(135deg, ${coverColors[0]}dd, ${coverColors[1]}dd)` }}
        >
          {track.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" />
          )}
        </div>

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

        <div className="flex items-center gap-1 flex-shrink-0">
          <TrendingUp size={10} className="text-black/25" />
          <span className="text-[10px] text-black/30">{formatNumber(track.plays_count)}</span>
        </div>

        <button
          onClick={(e) => handleToggleFavorite(e, track.id)}
          className="p-1.5 rounded-full hover:bg-black/5 transition-colors flex-shrink-0"
          aria-label={isTrackFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Star size={14} className={cn(isTrackFav ? 'fill-[#FFD700] text-[#FFD700]' : 'text-black/20')} />
        </button>
      </button>
    );
  };

  return (
    <div className="px-4 pt-4 pb-4 min-h-screen">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold gradient-text">Explorar</h1>
        <p className="text-black/40 text-sm mt-0.5">Descubra músicas, estações, artistas e usuários</p>
      </div>

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/25" />
          <input
            type="text"
            placeholder={
              exploreSection === 'estacoes'
                ? 'Buscar estações...'
                : exploreSection === 'artistas'
                ? 'Buscar artistas...'
                : exploreSection === 'usuarios'
                ? 'Buscar usuários por nome...'
                : 'Buscar músicas...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!pl-10 !py-2.5 !text-sm !rounded-xl"
          />
        </div>
      </div>

      {/* Sub-navegação: músicas, estações, artistas, usuários */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar">
        {(
          [
            { key: 'musicas', label: 'Músicas', icon: '🎵' },
            { key: 'estacoes', label: 'Estações', icon: '📻' },
            { key: 'artistas', label: 'Artistas', icon: '🎤' },
            { key: 'usuarios', label: 'Usuários', icon: '👤' },
          ] as { key: ExploreSection; label: string; icon: string }[]
        ).map((sec) => (
          <button
            key={sec.key}
            onClick={() => setExploreSection(sec.key)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 no-select',
              exploreSection === sec.key
                ? 'gradient-bg text-white shadow-md shadow-[#FF8C42]/20'
                : 'bg-white text-black/40 hover:bg-black/5 hover:text-black/60 shadow-sm'
            )}
          >
            <span>{sec.icon}</span>
            <span>{sec.label}</span>
          </button>
        ))}
      </div>

      {/* Músicas: todas as faixas do app */}
      {exploreSection === 'musicas' && (
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

      {/* Estações: estação padrão + estações publicadas por usuários */}
      {exploreSection === 'estacoes' && (
        <div className="space-y-2">
          <button
            onClick={() => handlePlayStation(DEFAULT_STATION_ID)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#FF8C42]/20 to-[#E84393]/20">
              <RadioTower size={18} className="text-[#FF8C42]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1B25] truncate">Rádio Zôada</p>
              <p className="text-xs text-black/40 truncate">Estação padrão · Shuffle infinito</p>
            </div>
            <Play size={16} className="text-[#FF8C42] flex-shrink-0" />
          </button>

          {filteredStations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <RadioTower size={28} className="text-black/20" />
              </div>
              <p className="text-black/40 text-sm font-medium">Nenhuma estação publicada ainda</p>
            </div>
          )}
          {filteredStations.map((station) => (
            <button
              key={station.id}
              onClick={() => handlePlayStation(station.id)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors text-left"
            >
              <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#FF8C42]/20 to-[#E84393]/20">
                {station.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={station.cover_url} alt={station.name} className="w-full h-full object-cover" />
                ) : (
                  <RadioTower size={18} className="text-[#FF8C42]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1A1B25] truncate">{station.name}</p>
                <p className="text-xs text-black/40 truncate">
                  {station.owner?.name ? `${station.owner.name} · ` : ''}
                  {station.tracks_count ?? 0} faixas
                </p>
              </div>
              <Play size={16} className="text-[#FF8C42] flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Artistas */}
      {exploreSection === 'artistas' && (
        <div className="space-y-3">
          {filteredArtists.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <Music2 size={28} className="text-black/20" />
              </div>
              <p className="text-black/40 text-sm font-medium">Nenhum artista encontrado</p>
            </div>
          )}
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

      {/* Usuários */}
      {exploreSection === 'usuarios' && (
        <div className="space-y-2">
          {!user && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <Users size={28} className="text-black/20" />
              </div>
              <p className="text-black/40 text-sm font-medium">Entre na sua conta para buscar outros usuários</p>
            </div>
          )}

          {user && !search.trim() && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <Users size={28} className="text-black/20" />
              </div>
              <p className="text-black/40 text-sm font-medium">Digite um nome pra buscar usuários</p>
            </div>
          )}

          {user && search.trim() && isSearchingUsers && (
            <div className="flex items-center justify-center py-12">
              <p className="text-black/40 text-sm">Buscando...</p>
            </div>
          )}

          {user && search.trim() && !isSearchingUsers && userResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <Users size={28} className="text-black/20" />
              </div>
              <p className="text-black/40 text-sm font-medium">Nenhum usuário encontrado com esse nome</p>
            </div>
          )}

          {user && !isSearchingUsers && userResults.map((result) => (
            <button
              key={result.id}
              onClick={() => selectUser(result.id)}
              className="w-full flex items-center gap-4 p-3 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors text-left"
            >
              <CoverArt
                title={result.name}
                artistName=""
                coverUrl={result.avatar_url || ''}
                size="sm"
                className="!w-12 !h-12 !max-w-none !rounded-full flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1A1B25] truncate">{result.name}</p>
              </div>
              <div className="p-2 rounded-full bg-black/5" aria-label="Ver perfil do usuário">
                <Users size={16} className="text-black/50" />
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

export default ExploreScreen;
