export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  last_seen_at?: string | null;
  created_at: string;
}

// Perfil público de OUTRO usuário (ex: quem comentou numa faixa, ou o
// dono de um artista) — mostrado na tela "user-profile". Diferente de
// `User`, que é sempre o usuário logado.
export interface PublicUserProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  last_seen_at?: string | null;
  created_at: string;
  followers_count: number;
  following_count: number;
  // Se o usuário logado está seguindo esse usuário (null quando não autenticado).
  is_following: boolean | null;
  // Artistas (perfis/catálogos) criados por esse usuário.
  artists: Artist[];
}

export interface Artist {
  id: string;
  user_id: string | null;
  name: string;
  avatar_url: string;
  cover_url: string;
  bio: string;
  genre: string;
  followers_count: number;
  // Nome real de quem criou o perfil (dono do upload) — pode ser null/undefined
  // se o artista não tiver dono (perfis demo/seed).
  owner_name?: string | null;
}

export interface Track {
  id: string;
  title: string;
  artist_id: string;
  artist_name: string;
  cover_url: string;
  audio_url: string;
  duration: number;
  plays_count: number;
  created_at: string;
}

// Faixa mais ouvida PELO USUÁRIO LOGADO (usado no "Mais ouvidas" do
// perfil). listen_count é o contador pessoal, diferente de plays_count
// (que é a contagem global/pública da faixa).
export interface TopListenedTrack extends Track {
  listen_count: number;
}

export interface Like {
  id: string;
  user_id: string;
  track_id: string;
  created_at: string;
  track?: Track;
}

export interface Follow {
  id: string;
  user_id: string;
  artist_id: string;
  created_at: string;
}

export interface UserFollow {
  id: string;
  follower_id: string;
  followed_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  track_id: string;
  content: string;
  created_at: string;
  user?: User;
}

// Comentário geral da rádio — não vinculado a nenhuma faixa específica,
// funciona como um chat aberto de quem está ouvindo a rádio no momento.
export interface RadioComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: User;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender?: User;
  // Faixa compartilhada nessa mensagem (opcional). Quando presente, a
  // mensagem é um "link de música" tocável em vez de um texto simples.
  track_id?: string | null;
  track?: Track | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  other_user: User;
  last_message: Message;
  unread_count: number;
}

export type Screen = 'login' | 'main' | 'player' | 'profile' | 'artist' | 'user-profile' | 'chat' | 'chat-conversation' | 'radio';

export type RadioTab = 'faixas' | 'explorar' | 'artistas';

// Estação de rádio de um usuário. Cada usuário pode ter uma estação própria
// com nome, capa opcional e uma lista ordenada de faixas. Quando publicada,
// fica disponível no seletor de estações da tela de Rádio. Várias estações
// podem estar publicadas simultaneamente — a escolha é local de cada ouvinte.
export interface RadioStation {
  id: string;
  user_id: string;
  name: string;
  cover_url: string | null;
  // Bio/descrição opcional da estação (ex: estilo musical, propósito).
  bio: string | null;
  // true = publicada/disponível no seletor. Múltiplas estações podem
  // estar publicadas ao mesmo tempo.
  is_published: boolean;
  // Faixa atual da transmissão (null até começar a tocar de verdade).
  current_track_id: string | null;
  // Timestamp ISO de quando a faixa atual começou (para sincronizar ouvintes).
  current_track_started_at: string | null;
  created_at: string;
  // Dados do dono da estação (preenchido em algumas respostas).
  owner?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  // Faixas da estação, na ordem escolhida (preenchido ao buscar com detalhes).
  tracks?: Track[];
}

// Resultado da busca de usuários por nome (aba "Fãs") — versão enxuta do
// perfil público, só com o necessário pra listar/clicar num resultado.
export interface UserSearchResult {
  id: string;
  name: string;
  avatar_url: string | null;
}
