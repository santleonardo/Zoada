// ============================================================
// ZÔADA — Configuração do Supabase
// ============================================================
// Preencha os campos abaixo com os dados do seu projeto Supabase.
// Encontre-os em: https://app.supabase.com → Project Settings → API
// ============================================================

export const SUPABASE_CONFIG = {
  // URL do projeto Supabase (ex: https://abcdef123456.supabase.co)
  URL: '',

  // Chave pública "anon public" (NÃO use a service_role key no frontend)
  ANON_KEY: '',
};

// Verificação simples
if (!SUPABASE_CONFIG.URL || !SUPABASE_CONFIG.ANON_KEY) {
  console.warn(
    '[ZÔADA] Supabase não configurado. O app funcionará com dados de demonstração.\n' +
    'Edite o arquivo src/lib/supabase.ts e preencha SUPABASE_CONFIG.URL e SUPABASE_CONFIG.ANON_KEY.'
  );
}

export const isSupabaseConfigured = !!(SUPABASE_CONFIG.URL && SUPABASE_CONFIG.ANON_KEY);
