export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  last_seen_at?: string | null;
  created_at: string;
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

export interface Comment {
  id: string;
  user_id: string;
  track_id: string;
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

export type Screen = 'login' | 'main' | 'player' | 'profile' | 'artist' | 'chat' | 'chat-conversation';
