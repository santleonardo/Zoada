'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  Flame,
  Music2,
  Camera,
  Edit3,
  FileText,
  ShieldCheck,
  Trash2,
  Download,
  Loader2,
  ShieldOff,
  Lock,
  User,
  Shield,
  Users,
  Share2,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { TopListenedTrack } from '@/types';
import { fetchTopListenedTracks, updateMyProfile, exportMyData, fetchPublicUserProfile } from '@/lib/api';
import { uploadImageFile } from '@/lib/trackUpload';
import GradientButton from './GradientButton';
import CoverArt from './CoverArt';
import Equalizer from './Equalizer';
import UploadMusicPanel from './UploadMusicPanel';
import MyTracksPanel from './MyTracksPanel';
import MyArtistsPanel from './MyArtistsPanel';
import MyRadioStationPanel from './MyRadioStationPanel';
import UserFeedPanel from './UserFeedPanel';
import SupportChatPanel from './SupportChatPanel';
import AudioQualityDialog from './AudioQualityDialog';
import NotificationSettingsDialog from './NotificationSettingsDialog';
import DeleteAccountDialog from './DeleteAccountDialog';
import TrashDialog from './TrashDialog';
import BlockedUsersDialog from './BlockedUsersDialog';
import FollowListDialog from './FollowListDialog';
import AlbumPanel from './AlbumPanel';

// Feature flags: "Enviar música" e "Criar estação de rádio" viraram
// funções premium (a serem lançadas no futuro). Por enquanto ficam
// ocultas do perfil, mas o código/painéis continuam aqui prontos —
// basta virar isto pra `true` quando o premium for lançado.
const PREMIUM_UPLOAD_MUSIC_ENABLED = false;
const PREMIUM_RADIO_STATION_ENABLED = false;

const ProfileScreen: React.FC = () => {
  const { user, logout, navigate, selectArtist, setUser, authToken, selectUser } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const profileCardRef = useRef<HTMLDivElement>(null);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followListTab, setFollowListTab] = useState<'followers' | 'following' | null>(null);
  // Só preenchido depois de montar no cliente (evita mismatch de hidratação
  // entre o `href` renderizado no servidor e o do navegador).
  const [inviteUrl, setInviteUrl] = useState('');

  useEffect(() => {
    setInviteUrl(window.location.origin);
  }, []);

  // Busca os contadores de seguidores/seguindo do próprio usuário — não vêm
  // no objeto `user` da sessão, então precisa desse fetch à parte (mesma
  // rota pública usada pra ver o perfil de outra pessoa).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchPublicUserProfile(user.id).then((profile) => {
      if (cancelled || !profile) return;
      setFollowCounts({ followers: profile.followers_count, following: profile.following_count });
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  const [audioQualityOpen, setAudioQualityOpen] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);
  const [privateProfileSaving, setPrivateProfileSaving] = useState(false);
  const [hideFollowListsSaving, setHideFollowListsSaving] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [tracksRefreshKey, setTracksRefreshKey] = useState(0);
  const [artistsRefreshKey, setArtistsRefreshKey] = useState(0);
  // Controla o pedido de "editar este artista" vindo do painel "Seus
  // Artistas": guarda qual artista e um contador que muda a cada clique
  // (pra funcionar mesmo clicando duas vezes seguidas no mesmo artista).
  const [focusArtistId, setFocusArtistId] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [topTracks, setTopTracks] = useState<TopListenedTrack[]>([]);
  // Seção "Mais Ouvidas" fechada por padrão; usuário abre clicando no cabeçalho.
  const [isTopTracksOpen, setIsTopTracksOpen] = useState(false);
  // Configurações agora em seções que expandem/escondem — "Conta" já vem
  // aberta (é a mais usada: editar perfil, notificações, perfil privado),
  // as outras começam fechadas pra lista não ficar comprida de cara.
  const [openSettingsSections, setOpenSettingsSections] = useState<Set<string>>(
    () => new Set(['conta'])
  );
  const toggleSettingsSection = (key: string) => {
    setOpenSettingsSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Busca as músicas que o usuário mais repetiu (contador pessoal de
  // reproduções), já ordenadas da mais ouvida pra menos ouvida.
  useEffect(() => {
    fetchTopListenedTracks(10).then(setTopTracks);
  }, []);

  const handleTogglePrivateProfile = async () => {
    if (!user || privateProfileSaving) return;
    const next = !user.private_profile;
    setPrivateProfileSaving(true);
    try {
      const updated = await updateMyProfile({ private_profile: next });
      if (updated) {
        setUser({
          ...user,
          private_profile:
            updated.private_profile !== undefined ? updated.private_profile : next,
        });
      }
    } catch {
      // Mantém o valor anterior se falhar
    } finally {
      setPrivateProfileSaving(false);
    }
  };

  const handleToggleHideFollowLists = async () => {
    if (!user || hideFollowListsSaving) return;
    const next = !user.hide_follow_lists;
    setHideFollowListsSaving(true);
    try {
      const updated = await updateMyProfile({ hide_follow_lists: next });
      if (updated) {
        setUser({
          ...user,
          hide_follow_lists:
            updated.hide_follow_lists !== undefined ? updated.hide_follow_lists : next,
        });
      }
    } catch {
      // Mantém o valor anterior se falhar
    } finally {
      setHideFollowListsSaving(false);
    }
  };

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Abre o modo de edição: reseta os campos com os dados atuais do
  // usuário (evita mostrar um rascunho velho de uma edição anterior
  // cancelada) e rola até o card de perfil, já que o botão "Editar
  // perfil" fica lá embaixo, na lista de Configurações.
  const handleStartEdit = () => {
    setName(user.name);
    setBio(user.bio || '');
    setAvatarPreview(user.avatar_url || null);
    setAvatarFile(null);
    setSaveError(null);
    setIsEditing(true);
    profileCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancelEdit = () => {
    setName(user.name);
    setBio(user.bio || '');
    setAvatarPreview(user.avatar_url || null);
    setAvatarFile(null);
    setSaveError(null);
    setIsEditing(false);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (file.type && !allowed.includes(file.type)) {
      setSaveError('Tipo não permitido. Use JPG, PNG, WebP, HEIC ou HEIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Imagem muito grande (máx. 5 MB). Escolha um arquivo menor.');
      return;
    }
    setSaveError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError('O nome não pode ficar vazio');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      // Sobe a foto nova pro R2 primeiro (se o usuário escolheu uma),
      // só então salva o perfil com a URL definitiva.
      const avatarUrl = avatarFile ? await uploadImageFile(avatarFile, 'avatars') : undefined;

      const trimmedBio = bio.trim();

      const updated = await updateMyProfile({
        name: trimmedName !== user.name ? trimmedName : undefined,
        avatarUrl,
        bio: trimmedBio !== (user.bio || '') ? trimmedBio : undefined,
      });

      if (updated) {
        // Persiste também no localStorage (via setUser com o token atual),
        // senão um reload traria de volta o nome/foto/bio antigos.
        setUser(updated, authToken);
        setAvatarPreview(updated.avatar_url || null);
        setBio(updated.bio || '');
      }

      setAvatarFile(null);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  // Baixar meus dados — direito de acesso e portabilidade (art. 18, II e V,
  // da LGPD). Não é destrutivo, então dispara direto sem diálogo de
  // confirmação; só mostra loading enquanto monta o arquivo e um erro
  // inline se a exportação falhar.
  const handleExportData = async () => {
    if (exportingData) return;
    setExportingData(true);
    setExportError(null);
    const ok = await exportMyData();
    if (!ok) {
      setExportError('Não foi possível exportar seus dados agora. Tente de novo em instantes.');
    }
    setExportingData(false);
  };

  // Link de convite: manda pro WhatsApp com uma mensagem pronta e o
  // endereço do próprio app (origin do navegador). É um `href` de verdade
  // (não um onClick com Web Share API), então funciona igual a Termos/
  // Privacidade — abre a conversa/compartilhamento numa aba nova.
  const inviteMessage = `Vem ouvir música comigo no Zôada! 🎶 ${inviteUrl}`;
  const inviteHref = `https://wa.me/?text=${encodeURIComponent(inviteMessage)}`;

  // Configurações agrupadas por seção (acordeão). "Conta" também guarda o
  // switch de Perfil privado, renderizado à parte por não ser um item de
  // navegação como os demais.
  const settingsSections: {
    key: string;
    title: string;
    icon: React.ReactNode;
    items: { icon: React.ReactNode; label: string; onClick?: () => void; href?: string }[];
  }[] = [
    {
      key: 'conta',
      title: 'Conta',
      icon: <User size={16} />,
      items: [
        { icon: <Edit3 size={18} />, label: 'Editar perfil', onClick: handleStartEdit },
        { icon: <Settings size={18} />, label: 'Notificações', onClick: () => setNotificationSettingsOpen(true) },
        { icon: <Share2 size={18} />, label: 'Convidar amigos', href: inviteHref },
      ],
    },
    {
      key: 'preferencias',
      title: 'Preferências',
      icon: <Music2 size={16} />,
      items: [
        { icon: <Music2 size={18} />, label: 'Qualidade de áudio', onClick: () => setAudioQualityOpen(true) },
      ],
    },
    {
      key: 'privacidade',
      title: 'Privacidade e dados',
      icon: <Shield size={16} />,
      items: [
        { icon: <ShieldOff size={18} />, label: 'Usuários bloqueados', onClick: () => setBlockedUsersOpen(true) },
        { icon: <Trash2 size={18} />, label: 'Lixeira', onClick: () => setTrashOpen(true) },
        {
          icon: exportingData ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />,
          label: exportingData ? 'Preparando seus dados...' : 'Baixar meus dados',
          onClick: handleExportData,
        },
      ],
    },
    {
      key: 'legal',
      title: 'Legal',
      icon: <FileText size={16} />,
      items: [
        { icon: <FileText size={18} />, label: 'Termos de Uso', href: '/termos' },
        { icon: <ShieldCheck size={18} />, label: 'Política de Privacidade', href: '/privacidade' },
      ],
    },
  ];

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold gradient-text">Perfil</h1>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 hover:bg-black/10 transition-colors text-black/60 hover:text-black/80 text-sm"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>

      {/* Profile Card */}
      <div ref={profileCardRef} className="rounded-2xl bg-white shadow-sm p-6 mb-6 text-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, #FF8C42, transparent)' }}
          />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, #6C5CE7, transparent)' }}
          />
        </div>

        <div className="relative z-10">
          {/* Avatar */}
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden gradient-bg flex items-center justify-center pulse-glow">
              {avatarPreview ? (
                <img src={avatarPreview} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-white">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => (isEditing ? avatarInputRef.current?.click() : handleStartEdit())}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#EFF0F6] border-2 border-white shadow-sm flex items-center justify-center hover:bg-[#E4E5EE] transition-colors"
              aria-label={isEditing ? 'Trocar foto de perfil' : 'Editar perfil'}
            >
              <Camera size={14} className="text-black/60" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          </div>

          {/* Name */}
          {isEditing ? (
            <div className="mb-1">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="!text-center !text-lg !font-bold !py-1.5 !px-4 w-full max-w-[220px] mx-auto block"
              />
            </div>
          ) : (
            <h2 className="text-xl font-bold text-[#1A1B25] mb-1">{user.name}</h2>
          )}

          <p className="text-black/40 text-sm mb-4">{user.email}</p>

          {/* Bio */}
          {isEditing ? (
            <div className="mb-4 max-w-[280px] mx-auto">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 280))}
                placeholder="Conte um pouco sobre você..."
                rows={3}
                className="w-full resize-none rounded-xl border border-black/10 bg-[#F7F7FB] px-3 py-2 text-sm text-[#1A1B25] placeholder:text-black/30 outline-none focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 transition-all"
              />
              <p className="text-[10px] text-black/30 text-right mt-0.5">{bio.length}/280</p>
            </div>
          ) : (
            user.bio && (
              <p className="text-sm text-black/60 leading-relaxed max-w-[280px] mx-auto mb-4 whitespace-pre-wrap">
                {user.bio}
              </p>
            )
          )}

          {/* Seguidores / Seguindo — clicáveis, abrem a lista de verdade */}
          {!isEditing && (
            <div className="flex items-center justify-center gap-6 mb-4">
              <button
                type="button"
                onClick={() => setFollowListTab('followers')}
                className="text-center active:opacity-60 transition-opacity"
              >
                <p className="text-lg font-bold text-[#1A1B25]">{followCounts.followers}</p>
                <p className="text-xs text-black/40">Seguidores</p>
              </button>
              <div className="w-px h-8 bg-black/10" />
              <button
                type="button"
                onClick={() => setFollowListTab('following')}
                className="text-center active:opacity-60 transition-opacity"
              >
                <p className="text-lg font-bold text-[#1A1B25]">{followCounts.following}</p>
                <p className="text-xs text-black/40">Seguindo</p>
              </button>
            </div>
          )}

          {isEditing && (
            <div className="flex flex-col items-center gap-2">
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-black/5 hover:bg-black/10 text-sm text-black/60 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <GradientButton onClick={handleSaveProfile} loading={saving} size="sm">
                  Salvar
                </GradientButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mais ouvidas: top 10 músicas que o usuário mais repetiu, da mais
          pra menos ouvida (ex: 15x aparece antes de uma ouvida 10x). */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setIsTopTracksOpen((prev) => !prev)}
          aria-expanded={isTopTracksOpen}
          className="flex items-center justify-between w-full mb-4"
        >
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-[#FF8C42]" fill="#FF8C42" />
            <h3 className="text-lg font-semibold text-[#1A1B25]">Mais Ouvidas</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-black/40">{topTracks.length} faixas</span>
            <ChevronDown
              size={18}
              className={`text-black/40 transition-transform ${isTopTracksOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {isTopTracksOpen && (topTracks.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
            <Music2 size={40} className="text-black/15 mx-auto mb-3" />
            <p className="text-black/40 text-sm">Nenhuma música ouvida repetidamente ainda</p>
            <button
              onClick={() => navigate('main')}
              className="mt-3 text-sm text-[#FF8C42] hover:text-[#FFB074] transition-colors"
            >
              Explorar músicas →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {topTracks.map((track, index) => (
              <div
                key={track.id}
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
        ))}
      </div>

      {/* Álbum de fotos do perfil */}
      <AlbumPanel userId={user.id} isOwner />

      {/* Seu feed: músicas que você postou no próprio perfil, com opção de apagar. */}
      <UserFeedPanel userId={user.id} isSelf />

      {/* Suas músicas enviadas (seção separada, com opção de editar e apagar).
          Função premium (futura): oculta do perfil por enquanto, sem
          remover o painel — ver PREMIUM_UPLOAD_MUSIC_ENABLED acima. */}
      {PREMIUM_UPLOAD_MUSIC_ENABLED && <MyTracksPanel refreshKey={tracksRefreshKey} />}

      {/* Upload de músicas novas — também é aqui que a edição de perfil de
          artista acontece de fato, quando "focada" por fora.
          Função premium (futura): oculta do perfil por enquanto, sem
          remover o painel — ver PREMIUM_UPLOAD_MUSIC_ENABLED acima. */}
      {PREMIUM_UPLOAD_MUSIC_ENABLED && (
        <UploadMusicPanel
          userName={user.name}
          onUploaded={() => setTracksRefreshKey((k) => k + 1)}
          refreshKey={artistsRefreshKey}
          focusArtistId={focusArtistId}
          focusToken={focusToken}
        />
      )}

      {/* Seus artistas: seção própria, separada do envio, com opção de
          editar (que leva pro painel de envio acima, já selecionado) e de
          apagar — ação destrutiva que merece confirmação própria.
          Função premium (futura): oculta do perfil por enquanto, sem
          remover o painel — ver PREMIUM_UPLOAD_MUSIC_ENABLED acima. */}
      {PREMIUM_UPLOAD_MUSIC_ENABLED && (
        <MyArtistsPanel
          refreshKey={artistsRefreshKey}
          onArtistDeleted={() => {
            setArtistsRefreshKey((k) => k + 1);
            setTracksRefreshKey((k) => k + 1);
          }}
          onEditArtist={(artistId) => {
            setFocusArtistId(artistId);
            setFocusToken((t) => t + 1);
          }}
        />
      )}

      {/* Estação de rádio pessoal: criar/editar/publicar/despublicar/apagar.
          Função premium (futura): oculta do perfil por enquanto, sem
          remover o painel — ver PREMIUM_RADIO_STATION_ENABLED acima. */}
      {PREMIUM_RADIO_STATION_ENABLED && <MyRadioStationPanel />}

      {/* Canal de mensagens direto com a Moderação — do outro lado está o
          painel externo em public/moderacao/index.html. */}
      <SupportChatPanel />

      {/* Settings — organizado em seções que expandem/escondem, cada uma
          com seu próprio cabeçalho clicável (acordeão: várias podem ficar
          abertas ao mesmo tempo). */}
      <div className="space-y-2 mb-6">
        <h3 className="text-lg font-semibold text-[#1A1B25] mb-3">Configurações</h3>

        <div className="space-y-2">
          {settingsSections.map((section) => {
            const isOpen = openSettingsSections.has(section.key);
            return (
              <div key={section.key} className="rounded-xl bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSettingsSection(section.key)}
                  className="flex items-center justify-between w-full p-3 hover:bg-[#F2F2F8] transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#1A1B25]">
                    <span className="text-black/40">{section.icon}</span>
                    {section.title}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-black/35 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-black/5 divide-y divide-black/5">
                    {/* Perfil privado mora dentro de "Conta" — é a única
                        linha com um switch em vez de navegar pra outro
                        lugar, por isso renderizada à parte dos `items`. */}
                    {section.key === 'conta' && (
                      <div className="flex items-center justify-between w-full p-3 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-black/50"><Lock size={18} /></span>
                          <div className="min-w-0">
                            <p className="text-sm text-[#1A1B25] font-medium">Perfil privado</p>
                            <p className="text-[11px] text-black/40 leading-snug">
                              Só seguidores veem postagens, artistas e mais ouvidas
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!user.private_profile}
                          aria-label="Perfil privado"
                          disabled={privateProfileSaving}
                          onClick={handleTogglePrivateProfile}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
                            user.private_profile ? 'bg-[#FF8C42]' : 'bg-black/15'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                              user.private_profile ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    )}

                    {/* Ocultar lista de Seguidores/Seguindo — mora na mesma
                        seção "Conta", também como switch em vez de link. */}
                    {section.key === 'conta' && (
                      <div className="flex items-center justify-between w-full p-3 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-black/50"><Users size={18} /></span>
                          <div className="min-w-0">
                            <p className="text-sm text-[#1A1B25] font-medium">Ocultar seguidores e seguindo</p>
                            <p className="text-[11px] text-black/40 leading-snug">
                              Só você vê as listas — o público continua vendo os números
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!user.hide_follow_lists}
                          aria-label="Ocultar seguidores e seguindo"
                          disabled={hideFollowListsSaving}
                          onClick={handleToggleHideFollowLists}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
                            user.hide_follow_lists ? 'bg-[#FF8C42]' : 'bg-black/15'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                              user.hide_follow_lists ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    )}

                    {section.items.map((item) => {
                      const content = (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="text-black/50">{item.icon}</span>
                            <span className="text-sm text-[#1A1B25]">{item.label}</span>
                          </div>
                          <ChevronRight size={16} className="text-black/25" />
                        </>
                      );

                      // Termos e Privacidade são rotas Next reais (fora do
                      // fluxo de telas do zustand), então abrem em nova aba
                      // como link de verdade — o resto continua botão
                      // disparando ação no app.
                      if (item.href) {
                        return (
                          <a
                            key={item.label}
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between w-full p-3 hover:bg-[#F2F2F8] transition-colors"
                          >
                            {content}
                          </a>
                        );
                      }

                      return (
                        <button
                          key={item.label}
                          onClick={item.onClick}
                          className="flex items-center justify-between w-full p-3 hover:bg-[#F2F2F8] transition-colors"
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {exportError && <p className="text-red-500 text-xs px-1 mt-2">{exportError}</p>}
      </div>


      {/* Excluir conta — ação destrutiva, separada visualmente do resto das
          Configurações (item 8 da Política de Privacidade). */}
      <button
        onClick={() => setDeleteAccountOpen(true)}
        className="flex items-center gap-3 w-full p-3 rounded-xl bg-white shadow-sm hover:bg-red-50 transition-colors mb-6"
      >
        <Trash2 size={18} className="text-red-400" />
        <span className="text-sm text-red-500 font-medium">Excluir conta</span>
      </button>

      {/* Bottom spacing */}
      <div className="h-32" />

      <AudioQualityDialog open={audioQualityOpen} onClose={() => setAudioQualityOpen(false)} />
      <NotificationSettingsDialog
        open={notificationSettingsOpen}
        onClose={() => setNotificationSettingsOpen(false)}
      />
      <DeleteAccountDialog open={deleteAccountOpen} onClose={() => setDeleteAccountOpen(false)} />
      <TrashDialog
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        onRestored={() => {
          setTracksRefreshKey((k) => k + 1);
          setArtistsRefreshKey((k) => k + 1);
        }}
      />
      <BlockedUsersDialog open={blockedUsersOpen} onClose={() => setBlockedUsersOpen(false)} />

      {user?.id && (
        <FollowListDialog
          open={followListTab !== null}
          onClose={() => setFollowListTab(null)}
          userId={user.id}
          initialTab={followListTab ?? 'followers'}
          onSelectUser={selectUser}
        />
      )}
    </div>
  );
};

export default ProfileScreen;
