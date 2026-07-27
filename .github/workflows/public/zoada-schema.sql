-- ============================================================
-- ZÔADA — Schema SQL para Supabase
-- Execute este SQL no SQL Editor do Supabase:
-- https://app.supabase.com → SQL Editor → New query
-- ============================================================

-- Tabela de usuários (estende o auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de artistas
CREATE TABLE IF NOT EXISTS public.artistas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT DEFAULT '',
  genero TEXT DEFAULT '',
  seguidores_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de faixas (músicas)
CREATE TABLE IF NOT EXISTS public.faixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  artista_id UUID NOT NULL REFERENCES public.artistas(id) ON DELETE CASCADE,
  cover_url TEXT,
  audio_url TEXT,
  duracao INTEGER NOT NULL DEFAULT 0, -- em segundos
  plays_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de curtidas
CREATE TABLE IF NOT EXISTS public.curtidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  faixa_id UUID NOT NULL REFERENCES public.faixas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, faixa_id)
);

-- Tabela de comentários
CREATE TABLE IF NOT EXISTS public.comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  faixa_id UUID NOT NULL REFERENCES public.faixas(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de mensagens (chat)
CREATE TABLE IF NOT EXISTS public.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  destinatario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Índices para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_faixas_artista ON public.faixas(artista_id);
CREATE INDEX IF NOT EXISTS idx_curtidas_usuario ON public.curtidas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_curtidas_faixa ON public.curtidas(faixa_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_faixa ON public.comentarios(faixa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_remetente ON public.mensagens(remetente_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_destinatario ON public.mensagens(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_criada ON public.mensagens(created_at);

-- ============================================================
-- RLS (Row Level Security) — Segurança a nível de linha
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curtidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Políticas RLS

-- Usuários: qualquer um autenticado pode ler; só pode editar o próprio perfil
CREATE POLICY "Usuarios_select" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Usuarios_insert" ON public.usuarios FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuarios_update" ON public.usuarios FOR UPDATE USING (auth.uid() = id);

-- Artistas: qualquer um pode ler
CREATE POLICY "Artistas_select" ON public.artistas FOR SELECT USING (true);

-- Faixas: qualquer um pode ler
CREATE POLICY "Faixas_select" ON public.faixas FOR SELECT USING (true);

-- Curtidas: autenticado pode ler/criar/deletar as próprias
CREATE POLICY "Curtidas_select" ON public.curtidas FOR SELECT USING (true);
CREATE POLICY "Curtidas_insert" ON public.curtidas FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Curtidas_delete" ON public.curtidas FOR DELETE USING (auth.uid() = usuario_id);

-- Comentários: autenticado pode ler/criar/deletar os próprios
CREATE POLICY "Comentarios_select" ON public.comentarios FOR SELECT USING (true);
CREATE POLICY "Comentarios_insert" ON public.comentarios FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Comentarios_delete" ON public.comentarios FOR DELETE USING (auth.uid() = usuario_id);

-- Mensagens: só pode ver/enviar mensagens onde é remetente ou destinatário
CREATE POLICY "Mensagens_select" ON public.mensagens FOR SELECT USING (auth.uid() IN (remetente_id, destinatario_id));
CREATE POLICY "Mensagens_insert" ON public.mensagens FOR INSERT WITH CHECK (auth.uid() = remetente_id);
CREATE POLICY "Mensagens_update" ON public.mensagens FOR UPDATE USING (auth.uid() IN (remetente_id, destinatario_id));

-- ============================================================
-- Trigger: criar perfil de usuário automaticamente ao registrar
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nome)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Trigger: incrementar plays_count quando uma curtida é criada
-- ============================================================
-- (Opcional: descomente se quiser track de reproduções)

-- CREATE OR REPLACE FUNCTION public.increment_plays()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   UPDATE public.faixas SET plays_count = plays_count + 1 WHERE id = NEW.faixa_id;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- ============================================================
-- Views úteis
-- ============================================================

-- View: faixas com nome do artista
CREATE OR REPLACE VIEW public.faixas_com_artista AS
SELECT
  f.*,
  a.nome AS artista_nome,
  a.avatar_url AS artista_avatar
FROM public.faixas f
JOIN public.artistas a ON f.artista_id = a.id;

-- View: contagem de curtidas por faixa
CREATE OR REPLACE VIEW public.faixas_curtidas_count AS
SELECT
  faixa_id,
  COUNT(*)::INTEGER AS total_curtidas
FROM public.curtidas
GROUP BY faixa_id;

-- ============================================================
-- Dados de exemplo (opcional)
-- ============================================================
-- Descomente para inserir dados de demo

/*
INSERT INTO public.artistas (nome, bio, genero, seguidores_count) VALUES
('DJ Thunder', 'Eletrônica | Bass Music', 'Eletrônica', 12400),
('Luna Vox', 'Indie | Dream Pop', 'Indie', 8900),
('MC Flow', 'Hip Hop | Trap', 'Hip Hop', 23100);

INSERT INTO public.faixas (titulo, artista_id, duracao, plays_count) VALUES
('Bass Drop', (SELECT id FROM public.artistas WHERE nome = 'DJ Thunder'), 215, 45000),
('Lua Cheia', (SELECT id FROM public.artistas WHERE nome = 'Luna Vox'), 198, 32000),
('Fogo na Rua', (SELECT id FROM public.artistas WHERE nome = 'MC Flow'), 175, 67000);
*/
