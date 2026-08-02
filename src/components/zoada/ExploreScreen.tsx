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

  // Cartão de música em grid (capa grande + barra de info), mesma
  // linguagem visual usada na Início pra manter consistência entre telas.
  const renderTrackCard = (track: Track) => {
    const isCurrentTrack = player.currentTrack?.id === track.id;
    const isTrackFav = favorites.includes(track.id);

    return (
      <button
        key={track.id}
        onClick={() => playTrack(track, filteredTracks)}
        className={cn(
          'relative rounded-2xl overflow-hidden text-left transition-all duration-200 active:scale-[0.97]',
          isCurrentTrack && 'ring-2 ring-[#FF8C42] shadow-lg shadow-[#FF8C42]/20'
        )}
      >
        <CoverArt title={track.title} artistName={track.artist_name} coverUrl={track.cover_url} size="lg" />

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center shadow-xl">
            <Play size={22} className="text-white ml-0.5" fill="white" />
          </div>
        </div>

        {/* Playing indicator */}
        {isCurrentTrack && player.isPlaying && (
          <div className="absolute top-2 right-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full glass">
              <Equalizer barCount={3} height={12} barWidth={2} gap={1} />
            </div>
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={(e) => handleToggleFavorite(e, track.id)}
          className="absolute top-2 left-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors z-10"
          aria-label={isTrackFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Star size={16} className={cn(isTrackFav ? 'fill-[#FFD700] text-[#FFD700]' : 'text-white/70')} />
        </button>

        {/* Info bar */}
        <div className="p-3 pt-0 -mt-3 relative">
          <div className="bg-white shadow-sm rounded-b-2xl px-3 py-2.5">
            <p className={cn('text-sm font-semibold truncate', isCurrentTrack ? 'text-[#FF8C42]' : 'text-[#1A1B25]')}>
              {track.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={(e) => track.artist_id && handleGoToArtist(e, track.artist_id)}
                className="text-xs text-black/40 hover:text-[#FF8C42] hover:underline transition-colors truncate"
              >
                {track.artist_name}
              </button>
              <span className="text-black/20">·</span>
              <div className="flex items-center gap-1">
                <TrendingUp size={10} className="text-black/30" />
                <span className="text-xs text-black/30">{formatNumber(track.plays_count)}</span>
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  };

  // Capa de fundo (gradiente determinístico + imagem, se houver) usada
  // nos cartões de estação e artista, igual ao esquema das músicas.
  // A logo oficial é uma marca (não uma foto), então mostramos ela
  // inteira com object-contain em vez de cortar as pontas com cover.
  const renderTileBackdrop = (name: string, imgUrl?: string | null, fallbackIcon?: React.ReactNode) => {
    const colors = COVER_COLORS[(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % COVER_COLORS.length];
    const isLogo = imgUrl === '/zoada-logo.png';
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${colors[0]}dd, ${colors[1]}dd)` }}
      >
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt=""
            className={cn('absolute inset-0 w-full h-full', isLogo ? 'object-contain p-4' : 'object-cover')}
          />
        ) : (
          fallbackIcon
        )}
      </div>
    );
  };

  // Cartão de estação em grid.
  const renderStationCard = (
    id: string,
    name: string,
    subtitle: string,
    imgUrl: string | null | undefined,
    onPlay: () => void
  ) => (
    <button
      key={id}
      onClick={onPlay}
      className="relative rounded-2xl overflow-hidden text-left transition-all duration-200 active:scale-[0.97]"
    >
      <div className="w-full aspect-square relative rounded-2xl overflow-hidden shadow-2xl">
        {renderTileBackdrop(name, imgUrl, <RadioTower size={40} className="text-white/70" />)}
      </div>
      <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center shadow-xl">
          <Play size={22} className="text-white ml-0.5" fill="white" />
        </div>
      </div>
      <div className="p-3 pt-0 -mt-3 relative">
        <div className="bg-white shadow-sm rounded-b-2xl px-3 py-2.5">
          <p className="text-sm font-semibold text-[#1A1B25] truncate">{name}</p>
          <p className="text-xs text-black/40 truncate mt-0.5">{subtitle}</p>
        </div>
      </div>
    </button>
  );

  // Cartão de artista em grid.
  const renderArtistCard = (artist: Artist) => (
    <button
      key={artist.id}
      onClick={() => selectArtist(artist.id)}
      className="relative rounded-2xl overflow-hidden text-left transition-all duration-200 active:scale-[0.97]"
    >
      <CoverArt
        title={artist.name}
        artistName={artist.genre}
        coverUrl={artist.avatar_url || artist.cover_url}
        size="lg"
      />
      <div className="p-3 pt-0 -mt-3 relative">
        <div className="bg-white shadow-sm rounded-b-2xl px-3 py-2.5">
          <p className="text-sm font-semibold text-[#1A1B25] truncate">{artist.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-black/40 truncate">{artist.genre}</span>
            <span className="text-black/20">·</span>
            <span className="text-xs text-black/30">{formatNumber(artist.followers_count)} seguidores</span>
          </div>
        </div>
      </div>
    </button>
  );

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

      {/* Músicas: todas as faixas do app, em grid de cartões */}
      {exploreSection === 'musicas' && (
        <div>
          {filteredTracks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <Music2 size={28} className="text-black/20" />
              </div>
              <p className="text-black/40 text-sm font-medium">Nenhuma faixa encontrada</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {filteredTracks.map((track) => renderTrackCard(track))}
          </div>
        </div>
      )}

      {/* Estações: estação padrão + estações publicadas por usuários, em grid */}
      {exploreSection === 'estacoes' && (
        <div>
          {filteredStations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <RadioTower size={28} className="text-black/20" />
              </div>
              <p className="text-black/40 text-sm font-medium">Nenhuma estação publicada ainda</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {renderStationCard(
              DEFAULT_STATION_ID,
              'Rádio Zôada',
              'Estação padrão · Shuffle infinito',
              '/zoada-logo.png',
              () => handlePlayStation(DEFAULT_STATION_ID)
            )}
            {filteredStations.map((station) =>
              renderStationCard(
                station.id,
                station.name,
                `${station.owner?.name ? `${station.owner.name} · ` : ''}${station.tracks_count ?? 0} faixas`,
                station.cover_url,
                () => handlePlayStation(station.id)
              )
            )}
          </div>
        </div>
      )}

      {/* Artistas, em grid de cartões */}
      {exploreSection === 'artistas' && (
        <div>
          {filteredArtists.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <Music2 size={28} className="text-black/20" />
              </div>
              <p className="text-black/40 text-sm font-medium">Nenhum artista encontrado</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {filteredArtists.map((artist) => renderArtistCard(artist))}
          </div>
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
