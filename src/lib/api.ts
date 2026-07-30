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

// Busca a lista real de conversas do usuário logado.
export async function fetchConversations(): Promise<Array<{
  id: string;
  user_id: string;
  other_user: { id: string; email: string; name: string; avatar_url: string | null; created_at: string };
  last_message: { id: string; sender_id: string; receiver_id: string; content: string; read: boolean; created_at: string };
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
export async function fetchMessages(partnerId: string): Promise<Array<{
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}>> {
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

// Envia uma mensagem de verdade (persistida no banco).
export async function sendMessageApi(receiverId: string, content: string): Promise<{
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
} | null> {
  try {
    const res = await apiFetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: receiverId, content }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[sendMessageApi] falha ao enviar mensagem:', err);
    return null;
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
