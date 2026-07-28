'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, TrendingUp, Play, Music2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_TRACKS, DEMO_ARTISTS } from '@/lib/demo-data';
import type { Track, Artist } from '@/types';
import CoverArt from './CoverArt';
import Equalizer from './Equalizer';
import { cn } from '@/lib/utils';

type Tab = 'tracks' | 'artists';

const MainScreen: React.FC = () => {
  const { playTrack, player, selectArtist, mainTab: activeTab, setMainTab: setActiveTab } = useAppStore();
  const [search, setSearch] = useState('');
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS);
  const [artists, setArtists] = useState<Artist[]>(DEMO_ARTISTS);

  // Busca faixas e artistas reais da API (a própria rota já retorna os dados
  // demo automaticamente enquanto o Neon não estiver configurado).
  useEffect(() => {
    fetch('/api/tracks')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.tracks) && data.tracks.length > 0) setTracks(data.tracks);
      })
      .catch(() => {
        // mantém os dados demo se a API falhar
      });

    fetch('/api/artists')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.artists) && data.artists.length > 0) setArtists(data.artists);
      })
      .catch(() => {
        // mantém os dados demo se a API falhar
      });
  }, []);

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

  const handlePlayTrack = (track: Track) => {
    playTrack(track, filteredTracks);
  };

  const formatNumber = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold gradient-text">
            {activeTab === 'tracks' ? 'Início' : 'Explorar'}
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            {activeTab === 'tracks' ? 'Suas faixas em alta' : 'Descubra novos artistas'}
          </p>
        </div>
        {player.isPlaying && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
            <Equalizer barCount={3} height={16} barWidth={2} gap={1} />
            <span className="text-xs text-white/60">Tocando</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Buscar músicas, artistas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!pl-11"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['tracks', 'artists'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 no-select',
              activeTab === tab
                ? 'gradient-bg text-white shadow-lg'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
            )}
          >
            {tab === 'tracks' ? '🎵 Faixas' : '🎤 Artistas'}
          </button>
        ))}
      </div>

      {/* Tracks Grid */}
      {activeTab === 'tracks' && (
        <div className="grid grid-cols-2 gap-3">
          {filteredTracks.map((track) => {
            const isCurrentTrack = player.currentTrack?.id === track.id;
            return (
              <button
                key={track.id}
                onClick={() => handlePlayTrack(track)}
                className={cn(
                  'relative rounded-2xl overflow-hidden text-left transition-all duration-200 active:scale-[0.97]',
                  isCurrentTrack && 'ring-2 ring-[#FF8C42] shadow-lg shadow-[#FF8C42]/20'
                )}
              >
                <CoverArt
                  title={track.title}
                  artistName={track.artist_name}
                  coverUrl={track.cover_url}
                  size="lg"
                />
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
                {/* Info bar */}
                <div className="p-3 pt-0 -mt-3 relative">
                  <div className="bg-[#1E2030] rounded-b-2xl px-3 py-2.5">
                    <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-white/40">{track.artist_name}</span>
                      <span className="text-white/20">·</span>
                      <div className="flex items-center gap-1">
                        <TrendingUp size={10} className="text-white/30" />
                        <span className="text-xs text-white/30">{formatNumber(track.plays_count)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Artists Grid */}
      {activeTab === 'artists' && (
        <div className="space-y-3">
          {filteredArtists.map((artist) => (
            <button
              key={artist.id}
              onClick={() => selectArtist(artist.id)}
              className="w-full flex items-center gap-4 p-3 rounded-2xl bg-[#1E2030] hover:bg-[#252840] transition-colors text-left"
            >
              <CoverArt
                title={artist.name}
                artistName={artist.genre}
                coverUrl={artist.avatar_url || artist.cover_url}
                size="sm"
                className="!w-14 !h-14 !max-w-none !rounded-xl flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{artist.name}</p>
                <p className="text-sm text-white/40">{artist.genre}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/50">{formatNumber(artist.followers_count)}</p>
                <p className="text-[10px] text-white/30">seguidores</p>
              </div>
              <div
                className="p-2 rounded-full bg-white/5"
                aria-label="Ver perfil do artista"
              >
                <Music2 size={16} className="text-white/60" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Bottom spacing for nav + mini player */}
      <div className="h-32" />
    </div>
  );
};

export default MainScreen;
