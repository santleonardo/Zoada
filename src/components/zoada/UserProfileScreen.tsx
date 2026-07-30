'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, Flame, MessageCircle, Music2, Users } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { fetchPublicUserProfile, fetchTopListenedTracks } from '@/lib/api';
import { isOnline, formatLastSeen } from '@/lib/presence';
import { formatNumber } from '@/lib/utils';
import type { PublicUserProfile, TopListenedTrack } from '@/types';
import CoverArt from './CoverArt';

/**
 * Perfil público de OUTRO usuário — aberto quando alguém clica no nome de
 * uma pessoa (dono de um artista, autor de um comentário, etc), em vez de
 * abrir a conversa direto. A conversa continua existindo, só que agora
 * como um botão explícito "Mensagem" dentro dessa tela.
 */
const UserProfileScreen: React.FC = () => {
  const { selectedUserId, goBack, user, selectConversation, navigate, selectArtist, playTrack } = useAppStore();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [topTracks, setTopTracks] = useState<TopListenedTrack[]>([]);

  useEffect(() => {
    if (!selectedUserId) return;
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    setTopTracks([]);

    fetchPublicUserProfile(selectedUserId).then((data) => {
      if (cancelled) return;
      if (!data) {
        setNotFound(true);
      } else {
        setProfile(data);
      }
      setIsLoading(false);
    });

    // Top 10 músicas mais ouvidas por ESSE usuário (não pelo usuário
    // logado), pra mostrar no perfil público dele.
    fetchTopListenedTracks(10, selectedUserId).then((data) => {
      if (!cancelled) setTopTracks(data);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  if (!selectedUserId) return null;

  const isSelf = selectedUserId === user?.id;
  const initials = (profile?.name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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
        <h1 className="text-xl font-bold text-[#1A1B25] truncate">Perfil</h1>
      </div>

      {isLoading && <p className="text-black/40 text-sm text-center py-16">Carregando...</p>}

      {!isLoading && notFound && (
        <div className="text-center py-16">
          <p className="text-black/50">Usuário não encontrado.</p>
        </div>
      )}

      {!isLoading && profile && (
        <>
          {/* Profile Card */}
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
              <div className="w-24 h-24 rounded-full overflow-hidden gradient-bg flex items-center justify-center mb-4">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-white">{initials}</span>
                )}
              </div>

              <h2 className="text-xl font-bold text-[#1A1B25] mb-1">{profile.name}</h2>

              <p className="text-xs text-black/40 mb-4">
                {isOnline(profile.last_seen_at) ? 'Online agora' : formatLastSeen(profile.last_seen_at)}
              </p>

              {/* Mensagem — não aparece no próprio perfil (não faz sentido
                  mandar mensagem pra si mesmo). */}
              {!isSelf && (
                <button
                  onClick={() => {
                    selectConversation(profile.id, profile.name);
                    navigate('chat-conversation');
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full gradient-bg text-white text-sm font-semibold active:scale-95 transition-all"
                >
                  <MessageCircle size={16} />
                  Mensagem
                </button>
              )}
            </div>
          </div>

          {/* Mais ouvidas: top 10 músicas que esse usuário mais repetiu,
              da mais pra menos ouvida (ex: 15x aparece antes de 10x). */}
          {topTracks.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-[#FF8C42]" fill="#FF8C42" />
                  <h3 className="font-semibold text-[#1A1B25]">
                    {isSelf ? 'Suas mais ouvidas' : 'Mais ouvidas'}
                  </h3>
                </div>
                <span className="text-sm text-black/40">{topTracks.length} faixas</span>
              </div>

              <div className="space-y-2">
                {topTracks.map((track, index) => (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track, topTracks)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm hover:bg-[#F2F2F8] transition-colors cursor-pointer group"
                  >
                    <span className="w-5 text-center text-sm font-bold text-black/25 flex-shrink-0">
                      {index + 1}
                    </span>
                    <CoverArt
                      title={track.title}
                      artistName={track.artist_name}
                      coverUrl={track.cover_url}
                      size="sm"
                      className="!w-12 !h-12 !max-w-none !rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1A1B25] truncate">{track.title}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (track.artist_id) selectArtist(track.artist_id);
                        }}
                        className="text-xs text-black/40 hover:text-[#FF8C42] hover:underline transition-colors truncate block text-left"
                      >
                        {track.artist_name}
                      </button>
                    </div>
                    <span className="text-xs text-black/40 flex-shrink-0">
                      {track.listen_count}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artistas criados por esse usuário */}
          <div className="flex items-center gap-2 mb-3">
            <Music2 size={18} className="text-[#FF8C42]" />
            <h3 className="font-semibold text-[#1A1B25]">
              {isSelf ? 'Seus artistas' : 'Artistas'}
            </h3>
          </div>

          {profile.artists.length === 0 ? (
            <p className="text-black/40 text-sm">
              {isSelf ? 'Você ainda não criou nenhum artista.' : 'Essa pessoa ainda não criou nenhum artista.'}
            </p>
          ) : (
            <div className="space-y-2">
              {profile.artists.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => selectArtist(artist.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors text-left"
                >
                  <CoverArt
                    title={artist.name}
                    artistName={artist.genre}
                    coverUrl={artist.avatar_url}
                    size="sm"
                    className="!w-12 !h-12 !max-w-none !rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1A1B25] truncate">{artist.name}</p>
                    <div className="flex items-center gap-1 text-black/40">
                      <Users size={11} />
                      <span className="text-xs">{formatNumber(artist.followers_count)} seguidores</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Bottom spacing for nav + mini player */}
      <div className="h-32" />
    </div>
  );
};

export default UserProfileScreen;
