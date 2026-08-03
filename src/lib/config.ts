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

// ---------- CRON (limpeza da lixeira, 30 dias após soft-delete) ----------
// Protege /api/cron/purge-deleted: só aceita a chamada se o header
// Authorization vier com esse valor. O Vercel Cron já manda
// `Authorization: Bearer ${CRON_SECRET}` automaticamente quando essa env
// var está configurada no projeto — não precisa fazer nada extra lá.
export const CRON_SECRET = process.env.CRON_SECRET || '';

// ---------- MODERAÇÃO (painel de denúncias, separado do app) ----------
// Protege /api/reports (leitura e atualização de status): só aceita a
// chamada se o header Authorization vier com `Bearer ${MODERATION_SECRET}`.
// O painel HTML em public/moderacao/index.html pede esse valor e guarda no
// localStorage do navegador de quem modera — nunca é exposto no app normal.
// IMPORTANTE: troque o valor padrão abaixo antes de ir para produção,
// definindo a env var MODERATION_SECRET.
export const MODERATION_SECRET = process.env.MODERATION_SECRET || 'zoada-dev-moderation-secret-change-in-production';

// Emails autorizados a entrar no painel de moderação pela tela de login
// (/api/moderacao/login). Precisa ser uma conta já existente no app (com
// senha cadastrada) — o login verifica email+senha contra a tabela
// `Usuario` normal e só libera a chave de moderação se o email bater com
// um destes. Separado por vírgula na env var pra dar pra ter mais de um
// admin sem mexer no código.
export const MODERATION_ADMIN_EMAILS = (process.env.MODERATION_ADMIN_EMAILS || 'zoadaapp@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// ---------- RÁDIO ZÔADA (estação padrão, singleton) ----------
// ID fixo da única linha da tabela `radio_padrao` — não existe (e nunca
// deve existir) mais de uma. Usado por /api/radio-padrao (leitura pública)
// e /api/moderacao/radio (escrita, painel de moderação).
export const RADIO_PADRAO_ID = 'radio-padrao-zoada';

// ---------- CONTA OFICIAL "ZÔADA" (posts no feed via painel de moderação) ----------
// Email fixo usado para localizar/criar (upsert) a conta oficial que aparece
// como dona dos posts publicados pela moderação na aba "Fãs" do app. Nome e
// avatar (logo) são sempre reforçados no upsert, então dá pra trocar aqui.
export const ZOADA_OFICIAL_EMAIL = process.env.ZOADA_OFICIAL_EMAIL || 'oficial@zoada.app';
export const ZOADA_OFICIAL_NOME = 'Zôada';
export const ZOADA_OFICIAL_AVATAR = '/zoada-logo.png';

// ---------- Helpers ----------
export const isNeonConfigured = !!NEON_CONFIG.DATABASE_URL;
export const isR2Configured = !!(R2_CONFIG.ACCOUNT_ID && R2_CONFIG.ACCESS_KEY_ID && R2_CONFIG.SECRET_ACCESS_KEY);

if (!isNeonConfigured || !isR2Configured) {
  console.warn(
    '[ZÔADA] Neon ou R2 não configurados. O app funcionará com dados de demonstração.\n' +
    'Edite o arquivo .env na raiz do projeto com as variáveis de ambiente.\n' +
    'Veja README.md para instruções completas.'
  );
}
