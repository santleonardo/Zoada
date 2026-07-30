export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
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

export interface Like {
  id: string;
  user_id: string;
  track_id: string;
  created_at: string;
  track?: Track;
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
}

export interface Conversation {
  id: string;
  user_id: string;
  other_user: User;
  last_message: Message;
  unread_count: number;
}

export type Screen = 'login' | 'main' | 'player' | 'profile' | 'artist' | 'chat' | 'chat-conversation';
