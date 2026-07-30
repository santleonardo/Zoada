import type { Track, Artist, User, Comment } from '@/types';

// ============================================================
// DADOS DE DEMONSTRAÇÃO
// Usados quando o Supabase não está configurado.
// ============================================================

export const DEMO_ARTISTS: Artist[] = [
  {
    id: 'artist-1',
    user_id: null,
    name: 'DJ Thunder',
    avatar_url: '/demo-artist-1.jpg',
    cover_url: '/demo-cover-1.jpg',
    bio: 'Eletrônica | Bass Music',
    genre: 'Eletrônica',
    followers_count: 12400,
  },
  {
    id: 'artist-2',
    user_id: null,
    name: 'Luna Vox',
    avatar_url: '/demo-artist-2.jpg',
    cover_url: '/demo-cover-2.jpg',
    bio: 'Indie | Dream Pop',
    genre: 'Indie',
    followers_count: 8900,
  },
  {
    id: 'artist-3',
    user_id: null,
    name: 'MC Flow',
    avatar_url: '/demo-artist-3.jpg',
    cover_url: '/demo-cover-3.jpg',
    bio: 'Hip Hop | Trap',
    genre: 'Hip Hop',
    followers_count: 23100,
  },
  {
    id: 'artist-4',
    user_id: null,
    name: 'Neon Pulse',
    avatar_url: '/demo-artist-4.jpg',
    cover_url: '/demo-cover-4.jpg',
    bio: 'Synthwave | Retro',
    genre: 'Synthwave',
    followers_count: 5600,
  },
  {
    id: 'artist-5',
    user_id: null,
    name: 'Sombra',
    avatar_url: '/demo-artist-5.jpg',
    cover_url: '/demo-cover-5.jpg',
    bio: 'R&B | Soul',
    genre: 'R&B',
    followers_count: 15200,
  },
  {
    id: 'artist-6',
    user_id: null,
    name: 'Banda Aurora',
    avatar_url: '/demo-artist-6.jpg',
    cover_url: '/demo-cover-6.jpg',
    bio: 'Rock Alternativo',
    genre: 'Rock',
    followers_count: 9800,
  },
  {
    id: 'artist-7',
    user_id: null,
    name: 'Kiko Beatz',
    avatar_url: '/demo-artist-7.jpg',
    cover_url: '/demo-cover-7.jpg',
    bio: 'Funk | Bass',
    genre: 'Funk',
    followers_count: 31200,
  },
  {
    id: 'artist-8',
    user_id: null,
    name: 'Velvet Skies',
    avatar_url: '/demo-artist-8.jpg',
    cover_url: '/demo-cover-8.jpg',
    bio: 'Lo-Fi | Chill',
    genre: 'Lo-Fi',
    followers_count: 18500,
  },
];

export const DEMO_TRACKS: Track[] = [];

export const DEMO_COMMENTS: Comment[] = [
  {
    id: 'comment-1',
    user_id: 'user-2',
    track_id: 'track-1',
    content: 'Essa batida é insana! 🔥',
    created_at: '2025-06-20T14:30:00Z',
    user: {
      id: 'user-2',
      email: 'maria@email.com',
      name: 'Maria Silva',
      avatar_url: null,
      created_at: '2025-01-01T00:00:00Z',
    },
  },
  {
    id: 'comment-2',
    user_id: 'user-3',
    track_id: 'track-1',
    content: 'Tô ouvindo em loop já',
    created_at: '2025-06-20T15:45:00Z',
    user: {
      id: 'user-3',
      email: 'pedro@email.com',
      name: 'Pedro Santos',
      avatar_url: null,
      created_at: '2025-01-05T00:00:00Z',
    },
  },
  {
    id: 'comment-3',
    user_id: 'user-2',
    track_id: 'track-3',
    content: 'MC Flow sempre entregando! 💪',
    created_at: '2025-06-21T10:00:00Z',
    user: {
      id: 'user-2',
      email: 'maria@email.com',
      name: 'Maria Silva',
      avatar_url: null,
      created_at: '2025-01-01T00:00:00Z',
    },
  },
];

export const DEMO_USER: User = {
  id: 'user-1',
  email: 'demo@zoada.com',
  name: 'Demo User',
  avatar_url: null,
  created_at: '2025-01-01T00:00:00Z',
};

// Color palette for generated cover art
export const COVER_COLORS = [
  ['#FF8C42', '#E84393'],
  ['#6C5CE7', '#00CEC9'],
  ['#E84393', '#6C5CE7'],
  ['#FDCB6E', '#FF8C42'],
  ['#00CEC9', '#6C5CE7'],
  ['#E84393', '#FF8C42'],
  ['#6C5CE7', '#E84393'],
  ['#FDCB6E', '#6C5CE7'],
];
