'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, Music2, Play, Users } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_ARTISTS, DEMO_TRACKS } from '@/lib/demo-data';
import type { Artist, Track } from '@/types';
import CoverArt from './CoverArt';
import Equalizer from './Equalizer';
import { cn, formatNumber } from '@/lib/utils';

const ArtistProfileScreen: React.FC = () => {
  const { selectedArtistId, goBack, playTrack, player, lastCountedPlay } = useAppStore();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mantém o número de reproduções exibido em sincronia assim que uma
  // reprodução é contabilizada de verdade (ver audioEngine.ts), sem
  // precisar recarregar a lista inteira da API.
  useEffect(() => {
    if (!lastCountedPlay) return;
    setTracks((prev) =>
      prev.map((t) => (t.id === lastCountedPlay.trackId ? { ...t, plays_count: t.plays_count + 1 } : t))
    );
  }, [lastCountedPlay]);

  useEffect(() => {
    if (!selectedArtistId) return;
    setIsLoading(true);

    // Busca o artista (a rota já cai no modo demo automaticamente se o
    // banco não estiver configurado).
    fetch('/api/artists')
      .then((res) => res.json())
      .then((data) => {
        const list: Artist[] = Array.isArray(data.artists) && data.artists.length > 0 ? data.artists : DEMO_ARTISTS;
        const found = list.find((a) => a.id === selectedArtistId) || null;
        setArtist(found);
      })
      .catch(() => {
        setArtist(DEMO_ARTISTS.find((a) => a.id === selectedArtistId) || null);
      });

    // Busca as faixas desse artista
    fetch(`/api/tracks?artist_id=${selectedArtistId}`)
      .then((res) => res.json())
      .then((data) => {
        const list: Track[] = Array.isArray(data.tracks) ? data.tracks : [];
        setTracks(list.length > 0 ? list : DEMO_TRACKS.filter((t) => t.artist_id === selectedArtistId));
      })
      .catch(() => {
        setTracks(DEMO_TRACKS.filter((t) => t.artist_id === selectedArtistId));
      })
      .finally(() => setIsLoading(false));
  }, [selectedArtistId]);

  const handlePlayTrack = (track: Track) => {
    playTrack(track, tracks);
  };

  if (!selectedArtistId) return null;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={goBack}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={22} className="text-white" />
        </button>
        <h1 className="text-xl font-bold text-white truncate">Perfil do artista</h1>
      </div>

      {!artist && !isLoading && (
        <div className="text-center py-16">
          <p className="text-white/50">Artista não encontrado.</p>
        </div>
      )}

      {artist && (
        <>
          {/* Artist Card */}
          <div className="rounded-2xl bg-[#1E2030] p-6 mb-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div
                className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle, #FF8C42, transparent)' }}
              />
              <div
                className="absolute bottom-0 left-0 w-40 h-40 rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle, #6C5CE7, transparent)' }}
              />
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <CoverArt
                title={artist.name}
                artistName={artist.genre}
                coverUrl={artist.avatar_url || artist.cover_url}
                size="sm"
                className="!w-24 !h-24 !max-w-none !rounded-full mb-4"
              />
              <h2 className="text-xl font-bold text-white">{artist.name}</h2>
              <p className="text-sm text-white/40 mb-3">{artist.genre}</p>

              <div className="flex items-center gap-1.5 text-white/50 text-sm mb-4">
                <Users size={14} />
                <span>{formatNumber(artist.followers_count)} seguidores</span>
              </div>

              {artist.bio && (
                <p className="text-sm text-white/60 leading-relaxed max-w-sm">{artist.bio}</p>
              )}
            </div>
          </div>

          {/* Tracks */}
          <div className="flex items-center gap-2 mb-3">
            <Music2 size={18} className="text-[#FF8C42]" />
            <h3 className="font-semibold text-white">Faixas</h3>
          </div>

          {isLoading ? (
            <p className="text-white/40 text-sm">Carregando...</p>
          ) : tracks.length === 0 ? (
            <p className="text-white/40 text-sm">Esse artista ainda não publicou faixas.</p>
          ) : (
            <div className="space-y-2">
              {tracks.map((track) => {
                const isCurrentTrack = player.currentTrack?.id === track.id;
                return (
                  <button
                    key={track.id}
                    onClick={() => handlePlayTrack(track)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl bg-[#1E2030] hover:bg-[#252840] transition-colors text-left',
                      isCurrentTrack && 'ring-1 ring-[#FF8C42]'
                    )}
                  >
                    <CoverArt
                      title={track.title}
                      artistName={track.artist_name}
                      coverUrl={track.cover_url}
                      size="sm"
                      className="!w-12 !h-12 !max-w-none !rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                      <p className="text-xs text-white/40">{formatNumber(track.plays_count)} reproduções</p>
                    </div>
                    {isCurrentTrack && player.isPlaying ? (
                      <Equalizer barCount={3} height={14} barWidth={2} gap={1} />
                    ) : (
                      <Play size={16} className="text-white/30" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Bottom spacing for nav + mini player */}
      <div className="h-32" />
    </div>
  );
};

export default ArtistProfileScreen;
