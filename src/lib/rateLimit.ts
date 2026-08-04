// ============================================================
// Rate limiting simples pra rotas sensíveis (login, registro, login de
// moderação) — sem isso, nada impedia alguém de tentar milhares de
// senhas por segundo contra /api/auth/login.
//
// Implementação em memória (Map), de propósito simples: funciona bem
// pra travar um ataque vindo de um IP específico dentro de UMA instância
// do servidor. Limitações importantes de saber:
//  - Em ambiente serverless (Vercel) com múltiplas instâncias, cada
//    instância tem seu próprio contador — o limite efetivo vira
//    "N tentativas x número de instâncias ativas", não um limite global
//    exato. Ainda assim já corta ataques de força bruta ingênuos.
//  - O contador é perdido a cada cold start/redeploy.
// Pra um limite realmente global e resistente, o próximo passo seria um
// rate limiter baseado em Redis/Upstash (ex: @upstash/ratelimit), que
// compartilha o contador entre todas as instâncias.
// ============================================================

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Evita crescimento infinito do Map em processos de vida longa: limpa
// entradas expiradas de vez em quando, a cada nova chamada.
function sweep(now: number) {
  if (buckets.size < 5000) return; // só varre quando começa a acumular
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Verifica e consome uma tentativa do "balde" identificado por `key`.
 * Retorna `{ allowed: false }` se o limite de `max` tentativas dentro da
 * janela de `windowMs` já foi atingido.
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Extrai um identificador de IP da requisição (best-effort). */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Confere se o header `Authorization` da requisição é exatamente
 * `Bearer <secret>`, em tempo constante (não vaza, por timing, quantos
 * caracteres do começo bateram). Usado nas rotas de moderação/cron, que
 * são protegidas por um único segredo estático em vez de login por
 * usuário — nesse caso vale o mesmo cuidado que se toma comparando
 * senhas ou tokens de sessão.
 */
export function isValidBearerSecret(request: Request, secret: string): boolean {
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto');
  return crypto.timingSafeEqual(a, b);
}
