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

import type { Message, Track, TopListenedTrack, PublicUserProfile } from '@/types';

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

  if (response.status === 401 && token && token !== 'demo') {
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

// Busca a lista de usuários que um usuário segue.
export async function fetchUserFollowing(userId: string): Promise<Array<{
  id: string; follower_id: string; followed_id: string; created_at: string;
}>> {
  try {
    const res = await apiFetch(`/api/follow-user?follower_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.follows) ? data.follows : [];
  } catch (err) {
    console.warn('[fetchUserFollowing] falha ao buscar seguindo:', err);
    return [];
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
// informado, transforma a mensagem em um "link de música" tocável — nesse
// caso `content` pode ficar vazio, que o servidor preenche um texto padrão.
export async function sendMessageApi(receiverId: string, content: string, trackId?: string): Promise<Message | null> {
  try {
    const res = await apiFetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: receiverId, content, track_id: trackId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[sendMessageApi] falha ao enviar mensagem:', err);
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

// Atualiza o perfil do usuário logado (nome e/ou avatar_url).
// Retorna os dados atualizados ou null em caso de erro.
export async function updateUserProfile(data: { name?: string; avatar_url?: string | null }): Promise<{
  id: string; email: string; name: string; avatar_url: string | null;
} | null> {
  try {
    const res = await apiFetch('/api/users', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const result = await res.json();
    return result.user ?? null;
  } catch (err) {
    console.warn('[updateUserProfile] falha ao atualizar perfil:', err);
    return null;
  }
}

// Faz upload de uma foto de perfil. Retorna a URL pública da imagem.
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
    console.warn('[uploadAvatar] falha ao fazer upload:', err);
    return null;
  }
}
