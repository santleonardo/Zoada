// ============================================================
// ZÔADA — Configuração do Neon + Cloudflare R2
// ============================================================
// Este arquivo gerencia a conexão com o backend da aplicação.
//
// O frontend NÃO se conecta diretamente ao Neon ou ao R2.
// Toda comunicação passa pelas API Routes do Next.js (/api/*).
//
// Variáveis de ambiente definidas no backend:
//   NEON_DATABASE_URL    → Connection string do Neon (Postgres)
//   R2_ACCOUNT_ID        → Cloudflare account ID
//   R2_ACCESS_KEY_ID     → R2 API token access key
//   R2_SECRET_ACCESS_KEY → R2 API token secret key
//   R2_BUCKET_NAME       → Nome do bucket R2
//   R2_PUBLIC_URL        → URL pública do bucket (r2.dev ou custom domain)
//   JWT_SECRET           → Chave secreta para assinatura dos tokens
// ============================================================

import type { Message, Track, TopListenedTrack, PublicUserProfile, RadioStation, RadioPadrao, Post, PostComment, Notification, Club, ClubMember, ClubPost, ClubPostComment } from '@/types';

// API base URL (relativa — o gateway cuida do proxy)
export const API_BASE = '';

// Auth token storage key in localStorage
export const AUTH_TOKEN_KEY = 'zoada-auth-token';
export const AUTH_USER_KEY = 'zoada-auth-user';

// ---------- Helpers ----------

// Get stored auth token
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Save auth token + user
export function saveAuth(token: string, user: { id: string; email: string; name: string; avatar_url: string | null }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

// Clear auth data
export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

// Get stored user
export function getStoredUser(): { id: string; email: string; name: string; avatar_url: string | null } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Authenticated fetch wrapper
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && token) {
    // Só força logout/reload se HAVIA um token sendo enviado (ou seja,
    // era uma sessão real que expirou/foi invalidada). Se não havia
    // token (ex: usuário em modo demo), não faz sentido "deslogar"
    // alguém que nunca esteve autenticado de verdade — quem chamou
    // apiFetch deve tratar o erro 401 normalmente (ex: mostrando uma
    // mensagem pedindo pra criar uma conta real).
    clearAuth();
    window.location.reload();
  }

  return response;
}

// Busca as curtidas salvas de um usuário no servidor.
export async function fetchUserLikes(userId: string): Promise<Array<{ id: string; user_id: string; track_id: string; created_at: string }>> {
  try {
    const res = await apiFetch(`/api/likes?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.likes) ? data.likes : [];
  } catch (err) {
    console.warn('[fetchUserLikes] falha ao buscar curtidas:', err);
    return [];
  }
}

// Busca as faixas favoritadas (estrela) reais do usuário no servidor —
// diferente de curtidas, e agora persistido no servidor (não só no
// localStorage do aparelho) pra também contar no ranking "Mais tocadas".
export async function fetchUserFavorites(userId: string): Promise<Array<{ id: string; user_id: string; track_id: string; created_at: string }>> {
  try {
    const res = await apiFetch(`/api/favorites?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.favorites) ? data.favorites : [];
  } catch (err) {
    console.warn('[fetchUserFavorites] falha ao buscar favoritos:', err);
    return [];
  }
}

// Busca as músicas que um usuário mais ouviu (contador pessoal, não a
// contagem global da faixa), já ordenadas da mais pra menos ouvida.
// Sem `userId`: busca do usuário logado (autenticado). Com `userId`:
// busca de outro usuário, pro perfil público dele (não exige login).
export async function fetchTopListenedTracks(limit = 10, userId?: string): Promise<TopListenedTrack[]> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (userId) params.set('user_id', userId);
    const res = await apiFetch(`/api/plays?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.tracks) ? data.tracks : [];
  } catch (err) {
    console.warn('[fetchTopListenedTracks] falha ao buscar mais ouvidas:', err);
    return [];
  }
}

// Busca o perfil público de OUTRO usuário (nome, foto, artistas que ele
// criou) — usado quando alguém clica no nome de uma pessoa (dono de um
// artista, autor de um comentário, etc).
export async function fetchPublicUserProfile(userId: string): Promise<PublicUserProfile | null> {
  try {
    const res = await apiFetch(`/api/users?id=${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch (err) {
    console.warn('[fetchPublicUserProfile] falha ao buscar perfil do usuário:', err);
    return null;
  }
}

// Faz upload de uma nova foto de perfil (multipart/form-data) para
// /api/avatar-upload. Retorna a URL pública da imagem, ou null se falhar.
export async function uploadAvatar(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiFetch('/api/avatar-upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch (err) {
    console.warn('[uploadAvatar] falha ao enviar foto:', err);
    return null;
  }
}

// Atualiza o PRÓPRIO perfil do usuário logado (nome e/ou foto). Retorna
// o usuário atualizado (vindo do servidor) em caso de sucesso, ou null
// se a chamada falhar.
export async function updateMyProfile(fields: {
  name?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  private_profile?: boolean;
  hide_follow_lists?: boolean;
}): Promise<{
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  bio?: string | null;
  created_at: string;
  private_profile?: boolean;
  hide_follow_lists?: boolean;
} | null> {
  try {
    const res = await apiFetch('/api/users', {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao atualizar perfil');
    }
    const data = await res.json();
    return data.user ?? null;
  } catch (err) {
    console.warn('[updateMyProfile] falha ao atualizar perfil:', err);
    throw err;
  }
}

// Curte/descurte uma faixa no servidor (toggle). Retorna o estado real
// após a operação, para manter o front sincronizado com o banco.
export async function toggleTrackLike(trackId: string): Promise<{
  liked: boolean;
  like?: { id: string; user_id: string; track_id: string; created_at: string };
} | null> {
  try {
    const res = await apiFetch('/api/likes', {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[toggleTrackLike] falha ao curtir/descurtir:', err);
    return null;
  }
}

export async function toggleTrackFavorite(trackId: string): Promise<{
  favorited: boolean;
  favorite?: { id: string; user_id: string; track_id: string; created_at: string };
} | null> {
  try {
    const res = await apiFetch('/api/favorites', {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[toggleTrackFavorite] falha ao favoritar/desfavoritar:', err);
    return null;
  }
}

// Busca os artistas que um usuário segue de verdade no servidor.
export async function fetchUserFollows(userId: string): Promise<Array<{ id: string; user_id: string; artist_id: string; created_at: string }>> {
  try {
    const res = await apiFetch(`/api/follow?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.follows) ? data.follows : [];
  } catch (err) {
    console.warn('[fetchUserFollows] falha ao buscar seguidos:', err);
    return [];
  }
}

// Segue/deixa de seguir um artista no servidor (toggle). Retorna o estado
// real após a operação — incluindo o followers_count já atualizado — para
// manter o front sincronizado com o banco.
export async function toggleArtistFollow(artistId: string): Promise<{
  following: boolean;
  followers_count: number;
  follow?: { id: string; user_id: string; artist_id: string; created_at: string };
} | null> {
  try {
    const res = await apiFetch('/api/follow', {
      method: 'POST',
      body: JSON.stringify({ artist_id: artistId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[toggleArtistFollow] falha ao seguir/deixar de seguir:', err);
    return null;
  }
}

// Segue/deixa de seguir um USUÁRIO no servidor (toggle). Retorna o estado
// real após a operação — incluindo os contadores já atualizados — para
// manter o front sincronizado com o banco.
export async function toggleUserFollow(followedId: string): Promise<{
  following: boolean;
  followers_count: number;
  following_count: number;
  follow?: { id: string; follower_id: string; followed_id: string; created_at: string };
} | null> {
  try {
    const res = await apiFetch('/api/follow-user', {
      method: 'POST',
      body: JSON.stringify({ followed_id: followedId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[toggleUserFollow] falha ao seguir/deixar de seguir usuário:', err);
    return null;
  }
}

// Uma pessoa dentro de uma lista de seguidores/seguindo — já com nome, foto
// e bio, prontos pra exibir (o back já faz o join, ver /api/follow-user).
export interface FollowListItem {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
}

// Resultado de uma busca de seguidores/seguindo: `hidden: true` quando o
// dono da lista optou por ocultá-la do público (ver toggle no Perfil) e
// quem está pedindo não é o próprio dono — nesse caso `items` vem vazio
// de propósito, não é ausência real de seguidores.
export interface FollowListResult {
  items: FollowListItem[];
  hidden: boolean;
}

// Busca a lista de usuários que um usuário segue ("Seguindo").
export async function fetchUserFollowing(userId: string): Promise<FollowListResult> {
  try {
    const res = await apiFetch(`/api/follow-user?follower_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return { items: [], hidden: false };
    const data = await res.json();
    const follows = Array.isArray(data.follows) ? data.follows : [];
    return { items: follows.map((f: { user: FollowListItem }) => f.user).filter(Boolean), hidden: !!data.hidden };
  } catch (err) {
    console.warn('[fetchUserFollowing] falha ao buscar seguindo:', err);
    return { items: [], hidden: false };
  }
}

// Busca a lista de quem segue um usuário ("Seguidores").
export async function fetchUserFollowers(userId: string): Promise<FollowListResult> {
  try {
    const res = await apiFetch(`/api/follow-user?followed_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return { items: [], hidden: false };
    const data = await res.json();
    const follows = Array.isArray(data.follows) ? data.follows : [];
    return { items: follows.map((f: { user: FollowListItem }) => f.user).filter(Boolean), hidden: !!data.hidden };
  } catch (err) {
    console.warn('[fetchUserFollowers] falha ao buscar seguidores:', err);
    return { items: [], hidden: false };
  }
}

// Verifica se um usuário segue outro.
export async function fetchUserFollowStatus(followerId: string, followedId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/follow-user?follower_id=${encodeURIComponent(followerId)}&followed_id=${encodeURIComponent(followedId)}`);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.is_following;
  } catch (err) {
    console.warn('[fetchUserFollowStatus] falha ao verificar status de seguir:', err);
    return false;
  }
}

// ---------- Bloqueio de usuários ----------
// Diferente de denunciar (vai pro painel de moderação analisar), bloquear é
// uma ação imediata e privada: trava a troca de mensagens nos dois sentidos
// e some da busca de "nova conversa" (ver /api/block-user).

export interface BlockedUser {
  id: string;
  name: string;
  avatar_url: string | null;
  blocked_at: string;
}

// Verifica o status de bloqueio entre o usuário logado e `otherUserId`,
// nas duas direções (eu bloqueei / fui bloqueado).
export async function fetchBlockStatus(otherUserId: string): Promise<{ i_blocked: boolean; blocked_by: boolean } | null> {
  try {
    const res = await apiFetch(`/api/block-user?other_id=${encodeURIComponent(otherUserId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[fetchBlockStatus] falha ao verificar bloqueio:', err);
    return null;
  }
}

// Bloqueia/desbloqueia um usuário (toggle). Retorna o novo estado (`blocked:
// true` = acabou de bloquear, `false` = acabou de desbloquear), ou uma
// string com a mensagem de erro do servidor em caso de falha.
export async function toggleBlockUser(blockedId: string): Promise<{ blocked: boolean } | string> {
  try {
    const res = await apiFetch('/api/block-user', {
      method: 'POST',
      body: JSON.stringify({ blocked_id: blockedId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error || 'Não foi possível processar o bloqueio.';
    }
    return await res.json();
  } catch (err) {
    console.warn('[toggleBlockUser] falha ao bloquear/desbloquear:', err);
    return 'Não foi possível processar o bloqueio.';
  }
}

// Lista os usuários que o usuário logado bloqueou (tela de "Usuários
// bloqueados" nas configurações do perfil).
export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  try {
    const res = await apiFetch('/api/block-user');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.blocked) ? data.blocked : [];
  } catch (err) {
    console.warn('[fetchBlockedUsers] falha ao buscar bloqueados:', err);
    return [];
  }
}

// Busca a lista real de conversas do usuário logado.
export async function fetchConversations(): Promise<Array<{
  id: string;
  user_id: string;
  other_user: { id: string; email: string; name: string; avatar_url: string | null; created_at: string };
  last_message: Message;
  unread_count: number;
}>> {
  try {
    const res = await apiFetch('/api/messages');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.conversations) ? data.conversations : [];
  } catch (err) {
    console.warn('[fetchConversations] falha ao buscar conversas:', err);
    return [];
  }
}

// Busca as mensagens reais trocadas com um usuário específico.
export async function fetchMessages(partnerId: string): Promise<Message[]> {
  try {
    const res = await apiFetch(`/api/messages?conversation_id=${encodeURIComponent(partnerId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.messages) ? data.messages : [];
  } catch (err) {
    console.warn('[fetchMessages] falha ao buscar mensagens:', err);
    return [];
  }
}

// Envia uma mensagem de verdade (persistida no banco). `trackId`, quando
// informado, transforma a mensagem em um "link de música" tocável; `audio`,
// quando informado, transforma a mensagem em uma mensagem de voz tocável.
// Em ambos os casos `content` pode ficar vazio, que o servidor preenche um
// texto padrão.
export async function sendMessageApi(
  receiverId: string,
  content: string,
  trackId?: string,
  audio?: { url: string; duration: number }
): Promise<Message | null> {
  try {
    const res = await apiFetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        receiver_id: receiverId,
        content,
        track_id: trackId,
        audio_url: audio?.url,
        audio_duration: audio?.duration,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[sendMessageApi] falha ao enviar mensagem:', err);
    return null;
  }
}

// ---------- Canal de mensagens com a Moderação ----------
// Conversa única e direta entre o usuário logado e a equipe de moderação
// (painel externo em public/moderacao/index.html). Diferente do chat entre
// usuários (/api/messages) — aqui não existe "lista de conversas", é
// sempre uma única thread por usuário.

export interface SupportMessage {
  id: string;
  usuario_id: string;
  remetente: 'USUARIO' | 'MODERADOR';
  conteudo: string;
  lida_pelo_usuario: boolean;
  lida_pelo_moderador: boolean;
  created_at: string;
}

// Busca a thread de mensagens do usuário logado com a moderação.
export async function fetchSupportMessages(): Promise<SupportMessage[]> {
  try {
    const res = await apiFetch('/api/moderacao/mensagens');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.messages) ? data.messages : [];
  } catch (err) {
    console.warn('[fetchSupportMessages] falha ao buscar mensagens com a moderação:', err);
    return [];
  }
}

// Envia uma mensagem para a moderação, na thread do usuário logado.
export async function sendSupportMessage(conteudo: string): Promise<SupportMessage | null> {
  try {
    const res = await apiFetch('/api/moderacao/mensagens', {
      method: 'POST',
      body: JSON.stringify({ conteudo }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.message ?? null;
  } catch (err) {
    console.warn('[sendSupportMessage] falha ao enviar mensagem para a moderação:', err);
    return null;
  }
}

// Busca todas as faixas disponíveis no catálogo (usado pelo seletor de
// "compartilhar música" no chat).
export async function fetchAllTracks(): Promise<Track[]> {
  try {
    const res = await apiFetch('/api/tracks');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.tracks) ? data.tracks : [];
  } catch (err) {
    console.warn('[fetchAllTracks] falha ao buscar faixas:', err);
    return [];
  }
}

// Envia um heartbeat de presença ("estou online agora"). Fire-and-forget:
// se falhar, não faz sentido travar nada — o usuário só deixa de aparecer
// online até o próximo heartbeat funcionar.
export async function sendHeartbeat(): Promise<void> {
  try {
    await apiFetch('/api/presence', { method: 'POST' });
  } catch (err) {
    console.warn('[sendHeartbeat] falha ao enviar heartbeat:', err);
  }
}

// Busca o status de presença (online / última vez visto) de um ou mais
// usuários de uma vez.
export async function fetchPresence(userIds: string[]): Promise<Record<string, { online: boolean; last_seen_at: string | null }>> {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return {};
  try {
    const res = await apiFetch(`/api/presence?user_ids=${encodeURIComponent(ids.join(','))}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.presence || {};
  } catch (err) {
    console.warn('[fetchPresence] falha ao buscar presença:', err);
    return {};
  }
}

// Busca usuários por nome/email — usado para iniciar uma nova conversa.
export async function searchUsers(query: string): Promise<Array<{
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}>> {
  try {
    const res = await apiFetch(`/api/users?search=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.users) ? data.users : [];
  } catch (err) {
    console.warn('[searchUsers] falha ao buscar usuários:', err);
    return [];
  }
}

// Busca os comentários reais de uma faixa no servidor.
export async function fetchTrackComments(trackId: string): Promise<Array<{
  id: string;
  user_id: string;
  track_id: string;
  content: string;
  created_at: string;
  user?: { id: string; email: string; name: string; avatar_url: string | null; created_at: string };
}>> {
  try {
    const res = await apiFetch(`/api/comments?track_id=${encodeURIComponent(trackId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.comments) ? data.comments : [];
  } catch (err) {
    console.warn('[fetchTrackComments] falha ao buscar comentários:', err);
    return [];
  }
}

// Envia um comentário de verdade (persistido no banco).
export async function postTrackComment(trackId: string, content: string): Promise<{
  id: string;
  user_id: string;
  track_id: string;
  content: string;
  created_at: string;
  user?: { id: string; email: string; name: string; avatar_url: string | null; created_at: string };
} | null> {
  try {
    const res = await apiFetch('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId, content }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[postTrackComment] falha ao enviar comentário:', err);
    return null;
  }
}

// Busca o chat geral da rádio (comentários que não pertencem a nenhuma faixa).
export async function fetchRadioComments(): Promise<Array<{
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: { id: string; email: string; name: string; avatar_url: string | null; created_at: string };
}>> {
  try {
    const res = await apiFetch('/api/radio-comments');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.comments) ? data.comments : [];
  } catch (err) {
    console.warn('[fetchRadioComments] falha ao buscar comentários da rádio:', err);
    return [];
  }
}

// Envia um comentário geral da rádio (não vinculado a nenhuma faixa).
export async function postRadioComment(content: string): Promise<{
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: { id: string; email: string; name: string; avatar_url: string | null; created_at: string };
} | null> {
  try {
    const res = await apiFetch('/api/radio-comments', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[postRadioComment] falha ao enviar comentário da rádio:', err);
    return null;
  }
}

// Registra uma reprodução de faixa (incrementa plays_count no servidor).
// Fire-and-forget: quem chama não precisa esperar nem tratar erro — se a
// contagem falhar (ex: rede caiu), simplesmente perdemos essa reprodução,
// o que não deve travar o player de jeito nenhum.
export async function registerTrackPlay(trackId: string): Promise<number | null> {
  try {
    const res = await apiFetch(`/api/tracks?id=${encodeURIComponent(trackId)}`, { method: 'PATCH' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.plays_count === 'number' ? data.plays_count : null;
  } catch (err) {
    console.warn('[registerTrackPlay] falha ao contabilizar reprodução:', err);
    return null;
  }
}

// ============================================================
// Estação de Rádio
// ============================================================

// Busca todas as estações publicadas (público, sem autenticação).
export async function fetchPublishedRadioStations(): Promise<RadioStation[]> {
  try {
    const res = await apiFetch('/api/radio-station?published=1');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.stations) ? data.stations : [];
  } catch (err) {
    console.warn('[fetchPublishedRadioStations] falha:', err);
    return [];
  }
}

// Busca o estado atual da "Rádio Zôada" (estação padrão, curada pela
// moderação em /api/moderacao/radio). Retorna null se a moderação ainda
// não configurou nada — nesse caso o cliente cai no fallback antigo
// (shuffle de todo o catálogo).
export async function fetchRadioPadrao(): Promise<RadioPadrao | null> {
  try {
    const res = await apiFetch('/api/radio-padrao');
    if (!res.ok) return null;
    const data = await res.json();
    return data.radio ?? null;
  } catch (err) {
    console.warn('[fetchRadioPadrao] falha:', err);
    return null;
  }
}

// Busca os dados completos de uma estação (com faixas) pelo ID.
export async function fetchRadioStationById(stationId: string): Promise<RadioStation | null> {
  try {
    const res = await apiFetch(`/api/radio-station?station_id=${encodeURIComponent(stationId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.station ?? null;
  } catch (err) {
    console.warn('[fetchRadioStationById] falha:', err);
    return null;
  }
}

// Busca a estação do usuário logado (exige autenticação).
// Retorna null se o usuário ainda não criou uma estação.
export async function fetchMyRadioStation(): Promise<RadioStation | null> {
  try {
    const res = await apiFetch('/api/radio-station?mine=1');
    if (!res.ok) return null;
    const data = await res.json();
    return data.station ?? null;
  } catch (err) {
    console.warn('[fetchMyRadioStation] falha:', err);
    return null;
  }
}

// Cria (ou atualiza, se já existir) a estação do usuário logado.
export async function saveRadioStation(fields: {
  name: string;
  cover_url?: string | null;
  bio?: string | null;
  track_ids: string[];
}): Promise<RadioStation | null> {
  try {
    const res = await apiFetch('/api/radio-station', {
      method: 'POST',
      body: JSON.stringify(fields),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.station ?? null;
  } catch (err) {
    console.warn('[saveRadioStation] falha:', err);
    return null;
  }
}

// Publica a estação do usuário logado (disponível no seletor).
export async function publishRadioStation(): Promise<RadioStation | null> {
  try {
    const res = await apiFetch('/api/radio-station', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'publish' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.station ?? null;
  } catch (err) {
    console.warn('[publishRadioStation] falha:', err);
    return null;
  }
}

// Despublica a estação do usuário logado (sai do seletor).
export async function unpublishRadioStation(): Promise<RadioStation | null> {
  try {
    const res = await apiFetch('/api/radio-station', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'unpublish' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.station ?? null;
  } catch (err) {
    console.warn('[unpublishRadioStation] falha:', err);
    return null;
  }
}

// Avança a faixa atual da estação (chamado quando a faixa atual termina).
export async function advanceRadioStation(): Promise<RadioStation | null> {
  try {
    const res = await apiFetch('/api/radio-station', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'advance' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.station ?? null;
  } catch (err) {
    console.warn('[advanceRadioStation] falha:', err);
    return null;
  }
}

// Apaga a estação do usuário logado.
export async function deleteRadioStation(): Promise<boolean> {
  try {
    const res = await apiFetch('/api/radio-station', { method: 'DELETE' });
    if (!res.ok) return false;
    return true;
  } catch (err) {
    console.warn('[deleteRadioStation] falha:', err);
    return false;
  }
}

// ---------- Feed (postar músicas no perfil) ----------

// Busca as postagens (músicas e/ou textos compartilhados) de um usuário,
// mais recente primeiro. Público — não exige login pra ver o feed de
// alguém, igual ao resto do perfil.
export async function fetchUserPosts(userId: string): Promise<Post[]> {
  try {
    const res = await apiFetch(`/api/posts?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.posts) ? data.posts : [];
  } catch (err) {
    console.warn('[fetchUserPosts] falha ao buscar postagens:', err);
    return [];
  }
}

// Busca o feed geral: postagens mais recentes de TODOS os usuários,
// usado na aba "Fãs" pra descobrir o que outras pessoas estão postando.
export async function fetchGlobalFeed(limit = 30): Promise<Post[]> {
  try {
    const res = await apiFetch(`/api/posts?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.posts) ? data.posts : [];
  } catch (err) {
    console.warn('[fetchGlobalFeed] falha ao buscar feed geral:', err);
    return [];
  }
}

// Cria uma postagem no feed do usuário logado. Precisa de pelo menos um
// dos dois: trackId (compartilhar uma música) ou content (post livre, só
// texto) — os dois juntos também são válidos (música + legenda).
export async function createPost(trackId?: string | null, content?: string): Promise<Post | null> {
  try {
    const res = await apiFetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId || null, content: content || '' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.post ?? null;
  } catch (err) {
    console.warn('[createPost] falha ao postar:', err);
    return null;
  }
}

// Apaga uma postagem própria do feed.
export async function deletePost(postId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/posts?id=${encodeURIComponent(postId)}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('[deletePost] falha ao apagar postagem:', err);
    return false;
  }
}

// Reage (coração) ou remove a reação da postagem em si (o OP que inicia a
// thread) — toggle. Retorna o estado real após a operação.
export async function togglePostLike(postId: string): Promise<{
  liked: boolean;
  likes_count: number;
} | null> {
  try {
    const res = await apiFetch('/api/post-likes', {
      method: 'POST',
      body: JSON.stringify({ post_id: postId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[togglePostLike] falha ao reagir à postagem:', err);
    return null;
  }
}

// Busca a thread de comentários de uma postagem do feed (pública).
export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  try {
    const res = await apiFetch(`/api/post-comments?post_id=${encodeURIComponent(postId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.comments) ? data.comments : [];
  } catch (err) {
    console.warn('[fetchPostComments] falha ao buscar comentários da postagem:', err);
    return [];
  }
}

// Envia um comentário na thread de uma postagem do feed (autenticado).
// Aceita texto e/ou um áudio já enviado ao R2 (ver useVoiceRecorder).
export async function postPostComment(
  postId: string,
  content: string,
  audio?: { url: string; duration: number }
): Promise<PostComment | null> {
  try {
    const res = await apiFetch('/api/post-comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: postId,
        content,
        audio_url: audio?.url,
        audio_duration: audio?.duration,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.comment ?? null;
  } catch (err) {
    console.warn('[postPostComment] falha ao comentar na postagem:', err);
    return null;
  }
}

// Apaga um comentário próprio da thread de uma postagem.
export async function deletePostComment(commentId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/post-comments?id=${encodeURIComponent(commentId)}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('[deletePostComment] falha ao apagar comentário:', err);
    return false;
  }
}

// Reage (coração) ou remove a reação de um comentário da thread do feed
// (toggle). Retorna o estado real após a operação, pra manter o front
// sincronizado com o banco.
export async function togglePostCommentLike(commentId: string): Promise<{
  liked: boolean;
  likes_count: number;
} | null> {
  try {
    const res = await apiFetch('/api/post-comment-likes', {
      method: 'POST',
      body: JSON.stringify({ comment_id: commentId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[togglePostCommentLike] falha ao reagir ao comentário:', err);
    return null;
  }
}

// ---------- Notificações ----------

// Busca as notificações do usuário logado (mais recentes primeiro) e a
// contagem de não lidas.
export async function fetchNotifications(limit = 30): Promise<{
  notifications: Notification[];
  unread_count: number;
}> {
  try {
    const res = await apiFetch(`/api/notifications?limit=${limit}`);
    if (!res.ok) return { notifications: [], unread_count: 0 };
    const data = await res.json();
    return {
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      unread_count: typeof data.unread_count === 'number' ? data.unread_count : 0,
    };
  } catch (err) {
    console.warn('[fetchNotifications] falha ao buscar notificações:', err);
    return { notifications: [], unread_count: 0 };
  }
}

// Só a contagem de não lidas — usado pra atualizar o badge do sininho
// periodicamente sem baixar a lista inteira toda vez.
export async function fetchUnreadNotificationsCount(): Promise<number> {
  try {
    const res = await apiFetch('/api/notifications?count_only=1');
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data.unread_count === 'number' ? data.unread_count : 0;
  } catch (err) {
    console.warn('[fetchUnreadNotificationsCount] falha ao buscar contagem:', err);
    return 0;
  }
}

// Marca UMA notificação como lida.
export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    const res = await apiFetch('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[markNotificationRead] falha ao marcar notificação como lida:', err);
    return false;
  }
}

// Marca TODAS as notificações do usuário logado como lidas.
export async function markAllNotificationsRead(): Promise<boolean> {
  try {
    const res = await apiFetch('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ all: true }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[markAllNotificationsRead] falha ao marcar notificações como lidas:', err);
    return false;
  }
}

// ---------- Lixeira (soft-delete: 30 dias pra desfazer) ----------

export interface TrashedTrack {
  id: string;
  title: string;
  cover_url: string | null;
  artist_id: string;
  artist_name: string;
  deleted_at: string;
  days_left: number;
}

export interface TrashedArtist {
  id: string;
  name: string;
  avatar_url: string | null;
  deleted_at: string;
  days_left: number;
}

export interface TrashedPost {
  id: string;
  content: string | null;
  track_title: string | null;
  cover_url: string | null;
  deleted_at: string;
  days_left: number;
}

export interface TrashedComment {
  id: string;
  content: string;
  post_id: string;
  deleted_at: string;
  days_left: number;
}

export interface TrashedStation {
  id: string;
  name: string;
  cover_url: string | null;
  deleted_at: string;
  days_left: number;
}

export interface TrashContents {
  tracks: TrashedTrack[];
  artists: TrashedArtist[];
  posts: TrashedPost[];
  comments: TrashedComment[];
  station: TrashedStation | null;
}

// Busca tudo que o usuário logado apagou e ainda está dentro da janela de
// 30 dias pra restaurar.
export async function fetchTrash(): Promise<TrashContents | null> {
  try {
    const res = await apiFetch('/api/trash');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[fetchTrash] falha ao buscar lixeira:', err);
    return null;
  }
}

async function restoreItem(path: string): Promise<boolean> {
  try {
    const res = await apiFetch(path, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'restore' }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[restoreItem] falha ao restaurar ${path}:`, err);
    return false;
  }
}

export const restoreTrack = (trackId: string) =>
  restoreItem(`/api/tracks?id=${encodeURIComponent(trackId)}`);

export const restoreArtist = (artistId: string) =>
  restoreItem(`/api/artists?id=${encodeURIComponent(artistId)}`);

export const restorePost = (postId: string) =>
  restoreItem(`/api/posts?id=${encodeURIComponent(postId)}`);

export const restorePostComment = (commentId: string) =>
  restoreItem(`/api/post-comments?id=${encodeURIComponent(commentId)}`);

export const restoreRadioStation = () => restoreItem('/api/radio-station');

// Baixa uma cópia de TODOS os dados pessoais do usuário logado, num
// arquivo .json (LGPD art. 18, incisos II e V — acesso e portabilidade).
// Dispara o download direto no navegador; não retorna o conteúdo pro
// chamador porque o objetivo é só entregar o arquivo pro usuário guardar.
export async function exportMyData(): Promise<boolean> {
  try {
    const res = await apiFetch('/api/account/data-export');
    if (!res.ok) return false;

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `zoada-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    return true;
  } catch (err) {
    console.warn('[exportMyData] falha ao exportar dados:', err);
    return false;
  }
}

// Tipos de conteúdo que podem ser denunciados — precisa bater com o enum
// TipoAlvoDenuncia do schema/API.
export type ReportTargetType = 'POSTAGEM' | 'POSTAGEM_CLUBE' | 'COMENTARIO_POSTAGEM' | 'COMENTARIO_POSTAGEM_CLUBE' | 'COMENTARIO_FAIXA' | 'FAIXA' | 'USUARIO';

// Envia uma denúncia (canal de denúncia/reporte — Marco Civil pós-STF
// 2025). Cai em /api/reports, que guarda um retrato do conteúdo pro
// painel de moderação separado (public/moderacao). Retorna `true` em
// caso de sucesso, ou uma string com a mensagem de erro do servidor.
export async function reportContent(
  tipoAlvo: ReportTargetType,
  alvoId: string,
  motivo: string,
  descricao?: string
): Promise<true | string> {
  try {
    const res = await apiFetch('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ tipo_alvo: tipoAlvo, alvo_id: alvoId, motivo, descricao }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error || 'Não foi possível enviar a denúncia.';
    }
    return true;
  } catch (err) {
    console.warn('[reportContent] falha ao denunciar:', err);
    return 'Não foi possível enviar a denúncia.';
  }
}

// Aviso global (banner na tela inicial), publicado pelo painel de
// moderação (public/moderacao). Leitura pública — funciona mesmo sem
// login. Retorna null se não houver nenhum aviso ativo no momento.
export type Aviso = { id: string; mensagem: string; created_at: string };

export async function fetchActiveAviso(): Promise<Aviso | null> {
  try {
    const res = await apiFetch('/api/aviso');
    if (!res.ok) return null;
    const data = await res.json();
    return data.aviso || null;
  } catch (err) {
    console.warn('[fetchActiveAviso] falha ao buscar aviso:', err);
    return null;
  }
}

// ---------- Clubes (comunidades de fãs, aba "Clube") ----------

// Lista os clubes existentes (mais recentes primeiro). Sem argumento
// mostra todos; com mine=true, só os clubes dos quais o usuário logado
// é membro (precisa estar autenticado).
export async function fetchClubs(mine = false): Promise<Club[]> {
  try {
    const res = await apiFetch(`/api/clubs${mine ? '?mine=1' : ''}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.clubs) ? data.clubs : [];
  } catch (err) {
    console.warn('[fetchClubs] falha ao buscar clubes:', err);
    return [];
  }
}

// Cria um clube novo. Quem cria vira automaticamente o admin dele.
export async function createClub(name: string, description?: string): Promise<Club | null> {
  try {
    const res = await apiFetch('/api/clubs', {
      method: 'POST',
      body: JSON.stringify({ name, description: description || '' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.club ?? null;
  } catch (err) {
    console.warn('[createClub] falha ao criar clube:', err);
    return null;
  }
}

// Edita nome, descrição (bio), capa e/ou senha de entrada de um clube já
// existente. Só o admin do clube pode chamar isso — a API confere e
// retorna 403 se não for. password: '' remove a senha (clube fica aberto).
export async function updateClub(
  clubId: string,
  fields: { name?: string; description?: string; cover_url?: string | null; password?: string }
): Promise<Club | null> {
  try {
    const res = await apiFetch('/api/clubs', {
      method: 'PATCH',
      body: JSON.stringify({
        club_id: clubId,
        name: fields.name,
        description: fields.description,
        cover_url: fields.cover_url,
        password: fields.password,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.club ?? null;
  } catch (err) {
    console.warn('[updateClub] falha ao editar clube:', err);
    return null;
  }
}

// Soft-delete de um clube. Só o admin consegue — a API confere o papel e
// retorna 403 caso contrário. O clube some das listagens na hora e fica
// 30 dias até o job de limpeza apagar de vez.
export async function deleteClub(clubId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/clubs?id=${encodeURIComponent(clubId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('[deleteClub] falha ao excluir clube:', err);
    return false;
  }
}

// Entra sozinho num clube (sem precisar de convite do admin). Se o clube
// tiver senha, passe `password`; devolve uma mensagem de erro específica
// (ex: "Senha incorreta") pra exibir no formulário de entrada.
export async function joinClub(
  clubId: string,
  password?: string
): Promise<{ member: ClubMember | null; error: string | null }> {
  try {
    const res = await apiFetch('/api/clubs/join', {
      method: 'POST',
      body: JSON.stringify({ club_id: clubId, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { member: null, error: data.error || 'Não foi possível entrar no clube.' };
    }
    return { member: data.member ?? null, error: null };
  } catch (err) {
    console.warn('[joinClub] falha ao entrar no clube:', err);
    return { member: null, error: 'Não foi possível entrar no clube.' };
  }
}

// Sobe uma nova foto de capa para um clube (só o admin consegue) e
// devolve a URL pública já pronta pra usar em updateClub.
export async function uploadClubCover(clubId: string, file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('club_id', clubId);
    const res = await apiFetch('/api/club-cover-upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch (err) {
    console.warn('[uploadClubCover] falha ao enviar capa do clube:', err);
    return null;
  }
}

// Lista os membros de um clube (só quem já é membro consegue ver).
export async function fetchClubMembers(clubId: string): Promise<ClubMember[]> {
  try {
    const res = await apiFetch(`/api/clubs/members?club_id=${encodeURIComponent(clubId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.members) ? data.members : [];
  } catch (err) {
    console.warn('[fetchClubMembers] falha ao buscar membros:', err);
    return [];
  }
}

// Convida (adiciona diretamente) um usuário a um clube. Só o admin do
// clube pode chamar isso com sucesso.
export async function inviteClubMember(clubId: string, userId: string): Promise<ClubMember | null> {
  try {
    const res = await apiFetch('/api/clubs/members', {
      method: 'POST',
      body: JSON.stringify({ club_id: clubId, user_id: userId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.member ?? null;
  } catch (err) {
    console.warn('[inviteClubMember] falha ao convidar membro:', err);
    return null;
  }
}

// Remove um membro do clube (ou sai do clube, quando userId é o próprio
// usuário logado).
export async function removeClubMember(clubId: string, userId: string): Promise<boolean> {
  try {
    const res = await apiFetch(
      `/api/clubs/members?club_id=${encodeURIComponent(clubId)}&user_id=${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch (err) {
    console.warn('[removeClubMember] falha ao remover membro:', err);
    return false;
  }
}

// Busca o mural (postagens) de um clube — só membros conseguem ver.
export async function fetchClubPosts(clubId: string): Promise<ClubPost[]> {
  try {
    const res = await apiFetch(`/api/clubs/posts?club_id=${encodeURIComponent(clubId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.posts) ? data.posts : [];
  } catch (err) {
    console.warn('[fetchClubPosts] falha ao buscar mural do clube:', err);
    return [];
  }
}

// Publica uma postagem no mural do clube — só membros conseguem postar.
export async function createClubPost(
  clubId: string,
  content: string,
  audio?: { url: string; duration: number }
): Promise<ClubPost | null> {
  try {
    const res = await apiFetch('/api/clubs/posts', {
      method: 'POST',
      body: JSON.stringify({
        club_id: clubId,
        content,
        audio_url: audio?.url,
        audio_duration: audio?.duration,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.post ?? null;
  } catch (err) {
    console.warn('[createClubPost] falha ao postar no clube:', err);
    return null;
  }
}

// Busca a thread de comentários de uma postagem do mural de um clube
// (só membros do clube conseguem ver).
export async function fetchClubPostComments(clubPostId: string): Promise<ClubPostComment[]> {
  try {
    const res = await apiFetch(`/api/club-post-comments?club_post_id=${encodeURIComponent(clubPostId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.comments) ? data.comments : [];
  } catch (err) {
    console.warn('[fetchClubPostComments] falha ao buscar comentários da postagem do clube:', err);
    return [];
  }
}

// Envia um comentário na thread de uma postagem do mural de um clube
// (só membros do clube conseguem comentar). Aceita texto e/ou um áudio já
// enviado ao R2 (ver useVoiceRecorder).
export async function postClubPostComment(
  clubPostId: string,
  content: string,
  audio?: { url: string; duration: number }
): Promise<ClubPostComment | null> {
  try {
    const res = await apiFetch('/api/club-post-comments', {
      method: 'POST',
      body: JSON.stringify({
        club_post_id: clubPostId,
        content,
        audio_url: audio?.url,
        audio_duration: audio?.duration,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.comment ?? null;
  } catch (err) {
    console.warn('[postClubPostComment] falha ao comentar na postagem do clube:', err);
    return null;
  }
}

// Apaga um comentário próprio da thread de uma postagem do mural de um clube.
export async function deleteClubPostComment(commentId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/club-post-comments?id=${encodeURIComponent(commentId)}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('[deleteClubPostComment] falha ao apagar comentário:', err);
    return false;
  }
}

// Restaura (desfaz o soft-delete de) um comentário próprio da thread de
// uma postagem do mural de um clube, dentro dos 30 dias.
export const restoreClubPostComment = (commentId: string) =>
  restoreItem(`/api/club-post-comments?id=${encodeURIComponent(commentId)}`);

// Reage (coração) ou remove a reação de um comentário da thread do mural
// de um clube (toggle). Retorna o estado real após a operação, pra manter
// o front sincronizado com o banco.
export async function toggleClubPostCommentLike(commentId: string): Promise<{
  liked: boolean;
  likes_count: number;
} | null> {
  try {
    const res = await apiFetch('/api/club-post-comment-likes', {
      method: 'POST',
      body: JSON.stringify({ comment_id: commentId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[toggleClubPostCommentLike] falha ao reagir ao comentário:', err);
    return null;
  }
}
