import { SignJWT, jwtVerify } from 'jose';
import { AUTH_CONFIG, isNeonConfigured } from './config';
import { db } from './db';
import type { User } from '@/types';

const secret = new TextEncoder().encode(AUTH_CONFIG.JWT_SECRET);

// ---------- Cache curto de status de suspensão ----------
// authenticateRequest roda em praticamente toda rota autenticada do app,
// então não dá pra bater no banco a cada request só pra checar suspensão.
// Guarda o resultado por poucos segundos: suspender alguém já em uso
// "pega" em no máximo esse intervalo, sem custo extra de query por request.
const SUSPENSAO_CACHE_MS = 15 * 1000;
const suspensaoCache = new Map<string, { suspenso: boolean; expiresAt: number }>();

async function isUsuarioSuspenso(userId: string): Promise<boolean> {
  if (!isNeonConfigured) return false;

  const cached = suspensaoCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.suspenso;
  }

  const user = await db.usuario.findUnique({
    where: { id: userId },
    select: { suspensoAte: true },
  });
  const suspenso = !!(user?.suspensoAte && user.suspensoAte.getTime() > Date.now());
  suspensaoCache.set(userId, { suspenso, expiresAt: Date.now() + SUSPENSAO_CACHE_MS });
  return suspenso;
}

// ---------- Create JWT token ----------
export async function createToken(payload: { userId: string; email: string }): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(AUTH_CONFIG.JWT_EXPIRES_IN)
    .sign(secret);
  return token;
}

// ---------- Verify JWT token ----------
export async function verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

// ---------- Extract Bearer token from request ----------
export function getTokenFromRequest(request: Request): string | null {
  // 1) Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 2) Cookie fallback
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`${AUTH_CONFIG.COOKIE_NAME}=([^;]+)`));
  if (match) return match[1];

  return null;
}

// Chamado pelo painel de moderação assim que suspende/reativa alguém, pra
// não depender do TTL do cache acima para o bloqueio (ou liberação) valer.
export function invalidateSuspensaoCache(userId: string) {
  suspensaoCache.delete(userId);
}

// ---------- Verify request and return userId ----------
// Retorna null tanto pra token ausente/inválido quanto pra usuário
// atualmente suspenso pela moderação — nesse último caso o token continua
// tecnicamente válido, mas o acesso é negado enquanto durar a suspensão.
export async function authenticateRequest(request: Request): Promise<string | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.userId) return null;

  if (await isUsuarioSuspenso(payload.userId)) return null;

  return payload.userId;
}

// ---------- Build user response object ----------
export function buildUserResponse(user: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  perfilPrivado?: boolean;
  ocultarListaSeguidores?: boolean;
}, token: string): User & { token: string } {
  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    avatar_url: user.avatarUrl || null,
    created_at: user.createdAt.toISOString(),
    private_profile: !!user.perfilPrivado,
    hide_follow_lists: !!user.ocultarListaSeguidores,
    token,
  };
}
