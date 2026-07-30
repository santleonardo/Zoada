'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, Music2, Play, Users, MessageCircle, UserPlus, UserCheck } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_ARTISTS, DEMO_TRACKS } from '@/lib/demo-data';
import type { Artist, Track } from '@/types';
import CoverArt from './CoverArt';
import Equalizer from './Equalizer';
import { cn, formatNumber } from '@/lib/utils';

const ArtistProfileScreen: React.FC = () => {
  const { selectedArtistId, goBack, playTrack, player, lastCountedPlay, user, selectConversation, navigate, isFollowingArtist, toggleFollow } = useAppStore();
  const isFollowing = selectedArtistId ? isFollowingArtist(selectedArtistId) : false;
  const [followBusy, setFollowBusy] = useState(false);
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
    let cancelled = false;
    setIsLoading(true);

    // Busca o artista (a rota já cai no modo demo automaticamente se o
    // banco não estiver configurado).
    fetch('/api/artists')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list: Artist[] = Array.isArray(data.artists) && data.artists.length > 0 ? data.artists : DEMO_ARTISTS;
        const found = list.find((a) => a.id === selectedArtistId) || null;
        setArtist(found);
      })
      .catch(() => {
        if (cancelled) return;
        setArtist(DEMO_ARTISTS.find((a) => a.id === selectedArtistId) || null);
      });

    // Busca as faixas desse artista
    fetch(`/api/tracks?artist_id=${selectedArtistId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list: Track[] = Array.isArray(data.tracks) ? data.tracks : [];
        setTracks(list.length > 0 ? list : DEMO_TRACKS.filter((t) => t.artist_id === selectedArtistId));
      })
      .catch(() => {
        if (cancelled) return;
        setTracks(DEMO_TRACKS.filter((t) => t.artist_id === selectedArtistId));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    // Se o usuário trocar de artista (ou sair da tela) antes dessas
    // buscas terminarem, essa flag impede que a resposta atrasada de um
    // artista ANTERIOR sobrescreva o estado com dados errados — sem isso,
    // o `artist.user_id` podia ficar "preso" no artista antigo mesmo com
    // a tela já mostrando outro, fazendo o botão "Mensagem" abrir sempre
    // a mesma conversa de antes.
    return () => {
      cancelled = true;
    };
  }, [selectedArtistId]);

  const handlePlayTrack = (track: Track) => {
    playTrack(track, tracks);
  };

  const handleToggleFollow = async () => {
    if (!selectedArtistId || followBusy) return;
    setFollowBusy(true);
    const newCount = await toggleFollow(selectedArtistId);
    // Se o servidor confirmou a operação, sincroniza o número exibido com
    // o valor real (evita o contador ficar dessincronizado do estado
    // otimista do botão em caso de corrida entre cliques).
    if (newCount !== null) {
      setArtist((prev) => (prev ? { ...prev, followers_count: newCount } : prev));
    }
    setFollowBusy(false);
  };

  if (!selectedArtistId) return null;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={goBack}
          className="p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={22} className="text-[#1A1B25]" />
        </button>
        <h1 className="text-xl font-bold text-[#1A1B25] truncate">Perfil do artista</h1>
      </div>

      {!artist && !isLoading && (
        <div className="text-center py-16">
          <p className="text-black/50">Artista não encontrado.</p>
        </div>
      )}

      {artist && (
        <>
          {/* Artist Card */}
          <div className="rounded-2xl bg-white shadow-sm p-6 mb-6 text-center relative overflow-hidden">
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
              <h2 className="text-xl font-bold text-[#1A1B25]">{artist.name}</h2>
              <p className="text-sm text-black/40 mb-1">{artist.genre}</p>

              {/* Nome de quem fez o upload desse artista — "artista" aqui é
                  uma persona/catálogo criado por um usuário, não uma conta
                  própria, então deixamos claro quem está por trás dele.
                  Só aparece quando há um dono real (perfis demo/seed sem
                  usuarioId não mostram essa linha). */}
              {artist.owner_name && (
                <p className="text-xs text-black/40 mb-3">
                  enviado por <span className="font-medium text-black/60">{artist.owner_name}</span>
                </p>
              )}

              <div className="flex items-center gap-1.5 text-black/50 text-sm mb-4">
                <Users size={14} />
                <span>{formatNumber(artist.followers_count)} seguidores</span>
              </div>

              {artist.bio && (
                <p className="text-sm text-black/60 leading-relaxed max-w-sm">{artist.bio}</p>
              )}

              {/* Seguir/Deixar de seguir — só aparece se não for o próprio
                  usuário logado dono desse artista (não faz sentido seguir
                  a si mesmo). Perfis demo/seed sem usuarioId também podem
                  ser seguidos normalmente. */}
              <div className="mt-4 flex items-center gap-2">
                {artist.user_id !== user?.id && (
                  <button
                    onClick={handleToggleFollow}
                    disabled={followBusy}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold active:scale-95 transition-all disabled:opacity-60',
                      isFollowing
                        ? 'bg-black/5 text-[#1A1B25]'
                        : 'gradient-bg text-white'
                    )}
                  >
                    {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
                    {isFollowing ? 'Seguindo' : 'Seguir'}
                  </button>
                )}

                {/* Mensagem — só aparece se o artista tiver um dono real
                    (perfis demo/seed sem usuarioId não podem receber
                    mensagem) e se não for o próprio usuário logado. */}
                {artist.user_id && artist.user_id !== user?.id && (
                  <button
                    onClick={() => {
                      // A conversa é sempre com a PESSOA (dono do upload), não
                      // com o "personagem" artista — por isso o nome mostrado
                      // na caixa de conversa é o nome real do dono, e o nome
                      // do artista vira só uma legenda menor de contexto.
                      selectConversation(artist.user_id as string, artist.owner_name || artist.name, artist.name);
                      navigate('chat-conversation');
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-black/5 text-[#1A1B25] text-sm font-semibold active:scale-95 transition-all"
                  >
                    <MessageCircle size={16} />
                    Mensagem
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tracks */}
          <div className="flex items-center gap-2 mb-3">
            <Music2 size={18} className="text-[#FF8C42]" />
            <h3 className="font-semibold text-[#1A1B25]">Faixas</h3>
          </div>

          {isLoading ? (
            <p className="text-black/40 text-sm">Carregando...</p>
          ) : tracks.length === 0 ? (
            <p className="text-black/40 text-sm">Esse artista ainda não publicou faixas.</p>
          ) : (
            <div className="space-y-2">
              {tracks.map((track) => {
                const isCurrentTrack = player.currentTrack?.id === track.id;
                return (
                  <button
                    key={track.id}
                    onClick={() => handlePlayTrack(track)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors text-left',
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
                      <p className="text-sm font-semibold text-[#1A1B25] truncate">{track.title}</p>
                      <p className="text-xs text-black/40">{formatNumber(track.plays_count)} reproduções</p>
                    </div>
                    {isCurrentTrack && player.isPlaying ? (
                      <Equalizer barCount={3} height={14} barWidth={2} gap={1} />
                    ) : (
                      <Play size={16} className="text-black/25" />
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
