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
  // Versão "economia de dados" (bitrate mais baixo), quando existir. Falta
  // em faixas enviadas antes dessa funcionalidade — nesse caso é null e o
  // player usa audio_url mesmo em modo economia.
  audio_url_low?: string | null;
  duration: number;
  plays_count: number;
  created_at: string;
  // Contadores usados no ranking "Mais tocadas" da Início, além de
  // plays_count: curtidas, favoritos, comentários, compartilhamentos
  // (faixa enviada numa conversa) e postagens no feed. Preenchidos pelo
  // endpoint de listagem de faixas (GET /api/tracks) — podem vir undefined
  // em respostas mais antigas/enxutas (ex: criação/edição de faixa).
  likes_count?: number;
  favorites_count?: number;
  comments_count?: number;
  shares_count?: number;
  posts_count?: number;
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

// Faixa salva pelo usuário na aba "Favoritos" (estrela) — diferente de Like
// (ação de "curtir"). Persistido no servidor pra também contar no ranking
// "Mais tocadas" da Início.
export interface Favorite {
  id: string;
  user_id: string;
  track_id: string;
  created_at: string;
  track?: Track;
}

// Postagem: uma música e/ou um texto que o usuário compartilhou no
// próprio feed/perfil (e no feed geral da aba Fãs). Diferente de Like
// (privado) — aparece publicamente pra quem visitar o perfil da pessoa,
// ou pra qualquer um no feed geral.
export interface Post {
  id: string;
  user_id: string;
  track_id: string | null;
  content: string | null;
  created_at: string;
  track?: Track | null;
  user?: { id: string; name: string; avatar_url: string | null } | null;
  // Quantidade de comentários na thread dessa postagem (preenchido pelo
  // GET /api/posts). Pode vir undefined em respostas mais antigas/enxutas.
  comments_count?: number;
  // Reação de coração na postagem em si (o OP que inicia a thread) —
  // quantidade total e se o usuário logado já reagiu (null se não autenticado).
  likes_count?: number;
  liked_by_me?: boolean | null;
}

// Comentário na thread de uma postagem do feed (aba "Fãs" e feed do
// perfil) — diferente de Comment, que é o comentário numa FAIXA.
export interface PostComment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  user?: { id: string; name: string; avatar_url: string | null } | null;
  // Reação de coração (curtida) num comentário da thread — quantidade total
  // e se o usuário logado já reagiu (null quando não autenticado).
  likes_count?: number;
  liked_by_me?: boolean | null;
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

export type Screen = 'login' | 'main' | 'player' | 'profile' | 'artist' | 'user-profile' | 'chat' | 'chat-conversation' | 'radio' | 'explore';

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
  // Soma do plays_count de todas as faixas da estação — usado como métrica
  // de "estação mais tocada" no ranking da home (preenchido nas respostas
  // que já carregam as faixas, ex: ?published=1).
  total_plays?: number;
  // Quantidade de faixas na estação (preenchido junto com total_plays).
  tracks_count?: number;
}

// Estação padrão "Rádio Zôada" (singleton, controlada pela moderação em
// /api/moderacao/radio). Lida publicamente em /api/radio-padrao.
export interface RadioPadrao {
  nome: string;
  cover_url: string | null;
  // true = moderação pausou a Rádio Zôada pra todo mundo.
  pausada: boolean;
  // Faixa atual + quando começou a tocar (mesmo mecanismo de RadioStation,
  // pra sincronizar quem estiver ouvindo).
  current_track_id: string | null;
  current_track_started_at: string | null;
  // Playlist curada pela moderação, na ordem escolhida. Vazia = a Rádio
  // Zôada volta ao comportamento padrão (shuffle de todo o catálogo).
  tracks: Track[];
}

// Rádio oficial criada pela moderação. Pertence ao app, não a um usuário.
// Pode haver várias, cada uma com sua própria playlist. Apenas uma
// pode estar "no ar" (on_air) por vez — é a transmissão oficial global.
export interface OfficialRadio {
  id: string;
  nome: string;
  cover_url: string | null;
  on_air: boolean;
  current_track_id: string | null;
  current_track_started_at: string | null;
  tracks_count: number;
  tracks?: Track[];
}

// Resultado da busca de usuários por nome (aba "Fãs") — versão enxuta do
// perfil público, só com o necessário pra listar/clicar num resultado.
export interface UserSearchResult {
  id: string;
  name: string;
  avatar_url: string | null;
}
