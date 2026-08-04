'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Flame, MessageCircle, Music2, Users, UserPlus, UserCheck, Flag, ShieldOff, Shield } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { fetchPublicUserProfile, fetchTopListenedTracks, toggleUserFollow, fetchBlockStatus, toggleBlockUser } from '@/lib/api';
import { isOnline, formatLastSeen } from '@/lib/presence';
import { formatNumber } from '@/lib/utils';
import { toast } from 'sonner';
import type { PublicUserProfile, TopListenedTrack } from '@/types';
import CoverArt from './CoverArt';
import UserFeedPanel from './UserFeedPanel';
import ReportModal from './ReportModal';

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
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Estado local otimista de seguir (para atualizar a tela na hora
  // sem depender de um re-fetch do perfil inteiro).
  const [localIsFollowing, setLocalIsFollowing] = useState<boolean | null>(null);
  const [localFollowersCount, setLocalFollowersCount] = useState<number | null>(null);
  const [reportProfileOpen, setReportProfileOpen] = useState(false);
  const [iBlocked, setIBlocked] = useState(false);
  const [blockedBy, setBlockedBy] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const isFollowing = localIsFollowing ?? profile?.is_following ?? false;
  const followersCount = localFollowersCount ?? profile?.followers_count ?? 0;
  const followingCount = profile?.following_count ?? 0;

  useEffect(() => {
    if (!selectedUserId) return;
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    setTopTracks([]);
    setLocalIsFollowing(null);
    setLocalFollowersCount(null);
    setIBlocked(false);
    setBlockedBy(false);

    fetchPublicUserProfile(selectedUserId).then((data) => {
      if (cancelled) return;
      if (!data) {
        setNotFound(true);
      } else {
        setProfile(data);
      }
      setIsLoading(false);
    });

    // Status de bloqueio nos dois sentidos (só faz sentido se estiver logado
    // e não for o próprio perfil — checado de novo aqui pra não disparar
    // requisição à toa no perfil do próprio usuário).
    if (user && selectedUserId !== user.id) {
      fetchBlockStatus(selectedUserId).then((status) => {
        if (cancelled || !status) return;
        setIBlocked(status.i_blocked);
        setBlockedBy(status.blocked_by);
      });
    }

    // Top 10 músicas mais ouvidas por ESSE usuário (não pelo usuário
    // logado), pra mostrar no perfil público dele.
    fetchTopListenedTracks(10, selectedUserId).then((data) => {
      if (!cancelled) setTopTracks(data);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedUserId, user]);

  const handleToggleFollow = useCallback(async () => {
    if (!selectedUserId || isFollowLoading) return;

    // Sem autenticação, não pode seguir
    if (!user) return;

    const before = isFollowing;
    const beforeCount = followersCount;

    // Atualização otimista
    setLocalIsFollowing(!before);
    setLocalFollowersCount(before ? Math.max(0, beforeCount - 1) : beforeCount + 1);

    setIsFollowLoading(true);
    const result = await toggleUserFollow(selectedUserId);
    setIsFollowLoading(false);

    if (!result) {
      // Falhou — desfaz
      setLocalIsFollowing(before);
      setLocalFollowersCount(beforeCount);
      return;
    }

    // Sincroniza com o servidor
    setLocalIsFollowing(result.following);
    setLocalFollowersCount(result.followers_count);

    // Atualiza também o perfil base (se houver re-render sem estado local)
    if (profile) {
      setProfile({
        ...profile,
        is_following: result.following,
        followers_count: result.followers_count,
      });
    }
  }, [selectedUserId, isFollowLoading, user, isFollowing, followersCount, profile]);

  const handleToggleBlock = async () => {
    if (!selectedUserId || blockLoading) return;
    if (!user) {
      toast.error('Entre na sua conta para bloquear usuários');
      return;
    }

    setBlockLoading(true);
    const result = await toggleBlockUser(selectedUserId);
    setBlockLoading(false);

    if (typeof result === 'string') {
      toast.error(result);
      return;
    }

    setIBlocked(result.blocked);
    toast.success(result.blocked ? 'Usuário bloqueado.' : 'Usuário desbloqueado.');

    // Bloquear desfaz o "seguir" nos dois sentidos no servidor — reflete
    // isso na tela na hora, em vez de esperar um re-fetch do perfil.
    if (result.blocked) {
      setLocalIsFollowing(false);
    }
  };

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
        <h1 className="text-xl font-bold text-[#1A1B25] truncate flex-1">Perfil</h1>
        {!isSelf && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleBlock}
              disabled={blockLoading}
              className={`p-2 rounded-full transition-colors disabled:opacity-50 ${
                iBlocked
                  ? 'bg-red-50 text-red-500 hover:bg-red-100'
                  : 'bg-black/5 hover:bg-red-50 hover:text-red-500 text-black/40'
              }`}
              aria-label={iBlocked ? 'Desbloquear usuário' : 'Bloquear usuário'}
              title={iBlocked ? 'Desbloquear' : 'Bloquear'}
            >
              {iBlocked ? <Shield size={18} /> : <ShieldOff size={18} />}
            </button>
            <button
              onClick={() => {
                if (!user) {
                  toast.error('Entre na sua conta para denunciar');
                  return;
                }
                setReportProfileOpen(true);
              }}
              className="p-2 rounded-full bg-black/5 hover:bg-[#E84393]/10 hover:text-[#E84393] text-black/40 transition-colors"
              aria-label="Denunciar perfil"
              title="Denunciar"
            >
              <Flag size={18} />
            </button>
          </div>
        )}
      </div>

      {!isSelf && iBlocked && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600">
          Você bloqueou {profile?.name || 'este usuário'}. Vocês não podem trocar mensagens enquanto isso.
        </div>
      )}
      {!isSelf && blockedBy && !iBlocked && (
        <div className="mb-4 p-3 rounded-xl bg-black/5 text-xs text-black/50">
          Não é possível interagir com este usuário no momento.
        </div>
      )}

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

              {/* Seguidores / Seguindo */}
              <div className="flex items-center gap-6 mb-5">
                <div className="text-center">
                  <p className="text-lg font-bold text-[#1A1B25]">{formatNumber(followersCount)}</p>
                  <p className="text-xs text-black/40">Seguidores</p>
                </div>
                <div className="w-px h-8 bg-black/10" />
                <div className="text-center">
                  <p className="text-lg font-bold text-[#1A1B25]">{formatNumber(followingCount)}</p>
                  <p className="text-xs text-black/40">Seguindo</p>
                </div>
              </div>

              {/* Ações — Seguir e Mensagem (não aparecem no próprio perfil,
                  nem enquanto houver bloqueio em qualquer sentido) */}
              {!isSelf && !iBlocked && !blockedBy && (
                <div className="flex items-center gap-3 w-full max-w-xs">
                  {/* Botão Seguir / Seguindo */}
                  <button
                    onClick={handleToggleFollow}
                    disabled={isFollowLoading}
                    className={`
                      flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold
                      active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                      ${isFollowing
                        ? 'bg-[#F2F2F8] text-[#1A1B25] hover:bg-[#E4E5EE]'
                        : 'gradient-bg text-white'
                      }
                    `}
                  >
                    {isFollowLoading ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : isFollowing ? (
                      <UserCheck size={16} />
                    ) : (
                      <UserPlus size={16} />
                    )}
                    {isFollowing ? 'Seguindo' : 'Seguir'}
                  </button>

                  {/* Botão Mensagem */}
                  <button
                    onClick={() => {
                      selectConversation(profile.id, profile.name);
                      navigate('chat-conversation');
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-black/5 hover:bg-black/10 text-sm font-semibold text-[#1A1B25] active:scale-95 transition-all"
                  >
                    <MessageCircle size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mais ouvidas: top 10 músicas que esse usuário mais repetiu,
              da mais pra menos ouvida (ex: 15x aparece antes de 10x). */}
          {topTracks.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Flame size={18} className="text-[#FF8C42]" fill="#FF8C42" />
                <h3 className="font-semibold text-[#1A1B25]">
                  {isSelf ? 'Suas mais ouvidas' : 'Mais ouvidas'}
                </h3>
              </div>

              <div className="grid grid-cols-4 auto-rows-[92px] grid-flow-row-dense gap-2">
                {topTracks.map((track, index) => {
                  // Padrão bento: alterna tamanhos de bloco a cada 6 faixas,
                  // com grid-flow-dense preenchendo os buracos automaticamente.
                  const bentoSpan = [
                    'col-span-2 row-span-2',
                    'col-span-2 row-span-1',
                    'col-span-1 row-span-1',
                    'col-span-1 row-span-1',
                    'col-span-2 row-span-1',
                    'col-span-2 row-span-1',
                  ][index % 6];

                  return (
                    <div
                      key={track.id}
                      onClick={() => playTrack(track, topTracks)}
                      className={`group relative rounded-2xl overflow-hidden cursor-pointer shadow-sm ${bentoSpan}`}
                    >
                      <CoverArt
                        title={track.title}
                        artistName={track.artist_name}
                        coverUrl={track.cover_url}
                        size="md"
                        className="!absolute !inset-0 !w-full !h-full !max-w-none !aspect-auto !rounded-2xl !shadow-none transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Gradiente pra legibilidade do texto por cima da capa */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                      {/* Título e artista */}
                      <div className="absolute bottom-0 left-0 right-0 p-2.5">
                        <p className="text-white text-sm font-semibold truncate drop-shadow">{track.title}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (track.artist_id) selectArtist(track.artist_id);
                          }}
                          className="text-[11px] text-white/70 hover:text-white hover:underline transition-colors truncate block text-left"
                        >
                          {track.artist_name}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feed: músicas postadas por esse usuário no próprio perfil. */}
          <UserFeedPanel userId={profile.id} isSelf={isSelf} />

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

      <ReportModal
        open={reportProfileOpen}
        onClose={() => setReportProfileOpen(false)}
        targetType="USUARIO"
        targetId={selectedUserId}
      />
    </div>
  );
};

export default UserProfileScreen;
