import { SignJWT, jwtVerify } from 'jose';
import { AUTH_CONFIG } from './config';
import type { User } from '@/types';

const secret = new TextEncoder().encode(AUTH_CONFIG.JWT_SECRET);

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

// ---------- Verify request and return userId ----------
export async function authenticateRequest(request: Request): Promise<string | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.userId ?? null;
}

// ---------- Build user response object ----------
export function buildUserResponse(user: { id: string; email: string; name: string | null; avatarUrl: string | null; createdAt: Date }, token: string): User & { token: string } {
  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    avatar_url: user.avatarUrl || null,
    created_at: user.createdAt.toISOString(),
    token,
  };
}
