// ============================================================
// ZÔADA — Configuração do Backend
// ============================================================
// MIGRADO: Supabase → Neon (Postgres) + Cloudflare R2
//
// Todas as configurações agora estão em:
//   src/lib/config.ts   — Variáveis de ambiente Neon + R2 + JWT
//   src/lib/api.ts      — Client helpers (token, fetch wrapper)
//   src/lib/auth.ts     — JWT create/verify (server-side)
//   src/lib/r2.ts       — Cloudflare R2 client (server-side)
//   src/lib/db.ts       — Prisma client (Neon Postgres)
//
// Para configurar, crie um arquivo .env na raiz:
//
//   NEON_DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
//   R2_ACCOUNT_ID=sua-cloudflare-account-id
//   R2_ACCESS_KEY_ID=sua-r2-access-key
//   R2_SECRET_ACCESS_KEY=sua-r2-secret-key
//   R2_BUCKET_NAME=zoada-storage
//   R2_PUBLIC_URL=https://pub-xxx.r2.dev
//   JWT_SECRET=sua-chave-secreta-super-forte
//
// Veja README.md para instruções completas.
// ============================================================

// Re-export para backward compatibility
export { isNeonConfigured, isR2Configured, NEON_CONFIG, R2_CONFIG, AUTH_CONFIG } from './config';

// Legacy alias
export const SUPABASE_CONFIG = {
  URL: '',
  ANON_KEY: '',
};
export const isSupabaseConfigured = false;
