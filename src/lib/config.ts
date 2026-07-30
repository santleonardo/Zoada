// ============================================================
// ZÔADA — Configuração do Neon + Cloudflare R2
// ============================================================
// Preencha os campos abaixo com os dados dos seus serviços.
// Tudo funciona com dados demo enquanto vazio.
// ============================================================

// ---------- NEON (Postgres) ----------
// Painel: https://console.neon.tech → Dashboard → Connection string
// Formato: postgresql://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require
export const NEON_CONFIG = {
  DATABASE_URL:
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    '',
};

// ---------- CLOUDFLARE R2 (S3-compatible Storage) ----------
// Painel: https://dash.cloudflare.com → R2 → Manage R2 API Tokens
export const R2_CONFIG = {
  ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  BUCKET_NAME: process.env.R2_BUCKET_NAME || 'zoada-storage',
  PUBLIC_URL: process.env.R2_PUBLIC_URL || '', // r2.dev public URL ou custom domain
};

// ---------- JWT AUTH ----------
export const AUTH_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'zoada-dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  COOKIE_NAME: 'zoada-token',
};

// ---------- Helpers ----------
export const isDbConfigured = !!NEON_CONFIG.DATABASE_URL;
export const isNeonConfigured = isDbConfigured;
export const isR2Configured = !!(R2_CONFIG.ACCOUNT_ID && R2_CONFIG.ACCESS_KEY_ID && R2_CONFIG.SECRET_ACCESS_KEY);

if (!isR2Configured) {
  console.warn(
    '[ZÔADA] R2 não configurado. Uploads de arquivos usarão armazenamento local.\n' +
    'Edite o arquivo .env na raiz do projeto com as variáveis de ambiente.\n' +
    'Veja README.md para instruções completas.'
  );
}
