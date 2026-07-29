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
