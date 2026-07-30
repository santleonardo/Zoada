-- ============================================================
-- ZÔADA — Neon Postgres Schema
-- ============================================================
-- Execute no SQL Editor do Neon:
--   https://console.neon.tech → Project → SQL Editor
--
-- Ou, se preferir, use o Prisma:
--   npx prisma db push
--   (o schema Prisma em prisma/schema.prisma é a fonte de verdade)
--
-- Este SQL serve como referência/documentação.
-- ============================================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  "avatarUrl" TEXT,
  bio TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de artistas
CREATE TABLE IF NOT EXISTS artistas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  "avatarUrl" TEXT,
  "coverUrl" TEXT,
  bio TEXT NOT NULL DEFAULT '',
  genero TEXT NOT NULL DEFAULT '',
  "seguidoresCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de faixas (músicas)
CREATE TABLE IF NOT EXISTS faixas (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  "artistaId" TEXT NOT NULL REFERENCES artistas(id) ON DELETE CASCADE,
  "coverUrl" TEXT,
  "audioUrl" TEXT,
  duracao INTEGER NOT NULL DEFAULT 0,
  "playsCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de curtidas
CREATE TABLE IF NOT EXISTS curtidas (
  id TEXT PRIMARY KEY,
  "usuarioId" TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  "faixaId" TEXT NOT NULL REFERENCES faixas(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("usuarioId", "faixaId")
);

-- Tabela de seguindo (usuário segue artista)
CREATE TABLE IF NOT EXISTS seguindo (
  id TEXT PRIMARY KEY,
  "usuarioId" TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  "artistaId" TEXT NOT NULL REFERENCES artistas(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("usuarioId", "artistaId")
);

-- Tabela de comentários
CREATE TABLE IF NOT EXISTS comentarios (
  id TEXT PRIMARY KEY,
  "usuarioId" TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  "faixaId" TEXT NOT NULL REFERENCES faixas(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de mensagens (chat)
CREATE TABLE IF NOT EXISTS mensagens (
  id TEXT PRIMARY KEY,
  "remetenteId" TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  "destinatarioId" TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  -- Faixa compartilhada nessa mensagem (opcional): permite enviar um "link"
  -- de música clicável dentro da conversa.
  "faixaId" TEXT REFERENCES faixas(id) ON DELETE SET NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_faixas_artistaId ON faixas("artistaId");
CREATE INDEX IF NOT EXISTS idx_curtidas_usuarioId ON curtidas("usuarioId");
CREATE INDEX IF NOT EXISTS idx_curtidas_faixaId ON curtidas("faixaId");
CREATE INDEX IF NOT EXISTS idx_seguindo_usuarioId ON seguindo("usuarioId");
CREATE INDEX IF NOT EXISTS idx_seguindo_artistaId ON seguindo("artistaId");
CREATE INDEX IF NOT EXISTS idx_comentarios_faixaId ON comentarios("faixaId");
CREATE INDEX IF NOT EXISTS idx_mensagens_remetenteId ON mensagens("remetenteId");
CREATE INDEX IF NOT EXISTS idx_mensagens_destinatarioId ON mensagens("destinatarioId");
CREATE INDEX IF NOT EXISTS idx_mensagens_createdAt ON mensagens("createdAt");
CREATE INDEX IF NOT EXISTS idx_mensagens_faixaId ON mensagens("faixaId");

-- Caso a tabela já exista de uma versão anterior sem essa coluna, rode:
-- ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS "faixaId" TEXT REFERENCES faixas(id) ON DELETE SET NULL;

-- ============================================================
-- Views úteis
-- ============================================================

-- View: faixas com nome do artista
CREATE OR REPLACE VIEW faixas_com_artista AS
SELECT
  f.*,
  a.nome AS "artistaNome",
  a."avatarUrl" AS "artistaAvatarUrl"
FROM faixas f
JOIN artistas a ON f."artistaId" = a.id;

-- View: contagem de curtidas por faixa
CREATE OR REPLACE VIEW faixas_curtidas_count AS
SELECT
  "faixaId",
  COUNT(*)::INTEGER AS "totalCurtidas"
FROM curtidas
GROUP BY "faixaId";
