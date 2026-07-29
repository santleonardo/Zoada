import { create } from 'zustand';
import type { User, Track, Screen, Message, Comment, Like } from '@/types';
import { getAuthToken, getStoredUser, saveAuth, clearAuth } from '@/lib/api';

const FAVORITES_KEY = 'zoada-favorites';

function loadFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
}

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;

  // Navigation
  currentScreen: Screen;
  previousScreen: Screen | null;
  mainTab: 'tracks' | 'artists' | 'favorites';

  // Player
  player: PlayerState;
  queue: Track[];
  queueIndex: number;
  shuffleEnabled: boolean;
  repeatMode: 'off' | 'all' | 'one';

  // Chat
  selectedConversationId: string | null;
  selectedConversationName: string | null;

  // Artist profile (perfil público de um artista)
  selectedArtistId: string | null;

  // Social
  likes: Like[];
  comments: Comment[];

  // Favorites
  favorites: string[]; // track IDs

  // Actions - Auth
  setUser: (user: User | null, token?: string | null) => void;
  logout: () => void;
  restoreSession: () => void;

  // Actions - Navigation
  navigate: (screen: Screen, tab?: 'tracks' | 'artists' | 'favorites') => void;
  goBack: () => void;
  setMainTab: (tab: 'tracks' | 'artists' | 'favorites') => void;

  // Actions - Player
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  nextTrack: (auto?: boolean) => void;
  prevTrack: () => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;

  // Actions - Chat
  selectConversation: (id: string, name: string) => void;

  // Actions - Artist profile
  selectArtist: (id: string) => void;

  // Actions - Social
  setLikes: (likes: Like[]) => void;
  toggleLike: (trackId: string) => void;
  setComments: (comments: Comment[]) => void;
  addComment: (comment: Comment) => void;

  // Actions - Favorites
  toggleFavorite: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;
  initFavorites: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  authToken: getAuthToken(),
  currentScreen: 'login',
  previousScreen: null,
  mainTab: 'tracks',
  selectedConversationId: null,
  selectedConversationName: null,
  selectedArtistId: null,
  likes: [],
  comments: [],
  favorites: [],

  player: {
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    duration: 0,
    volume: 0.8,
  },

  queue: [],
  queueIndex: 0,
  shuffleEnabled: false,
  repeatMode: 'off',

  // Auth actions
  setUser: (user, token) => {
    if (token !== null && token !== undefined) {
      if (user && token) {
        saveAuth(token, { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url });
      } else {
        clearAuth();
      }
    }
    set({
      user,
      authToken: token ?? getAuthToken(),
      isAuthenticated: !!user,
      currentScreen: user ? 'main' : 'login',
    });
  },

  logout: () => {
    clearAuth();
    set({
      user: null,
      isAuthenticated: false,
      authToken: null,
      currentScreen: 'login',
      previousScreen: null,
      player: {
        currentTrack: null,
        isPlaying: false,
        progress: 0,
        duration: 0,
        volume: 0.8,
      },
      queue: [],
      queueIndex: 0,
      shuffleEnabled: false,
      repeatMode: 'off',
    });
  },

  restoreSession: () => {
    const token = getAuthToken();
    const stored = getStoredUser();
    if (token && stored) {
      set({
        user: {
          ...stored,
          created_at: '',
        },
        authToken: token,
        isAuthenticated: true,
        currentScreen: 'main',
      });
    }
  },

  // Navigation actions
  navigate: (screen, tab) => set((state) => ({
    previousScreen: state.currentScreen,
    currentScreen: screen,
    mainTab: tab ?? state.mainTab,
  })),

  setMainTab: (tab) => set({ mainTab: tab }),

  goBack: () => set((state) => ({
    currentScreen: state.previousScreen || 'main',
    previousScreen: null,
  })),

  // Player actions
  playTrack: (track, queue) => {
    const state = get();
    const newQueue = queue || state.queue;
    const index = newQueue.findIndex(t => t.id === track.id);
    set({
      player: {
        ...state.player,
        currentTrack: track,
        isPlaying: true,
        progress: 0,
      },
      queue: newQueue,
      queueIndex: index >= 0 ? index : 0,
    });
  },

  togglePlay: () => set((state) => ({
    player: {
      ...state.player,
      isPlaying: !state.player.isPlaying,
    },
  })),

  setProgress: (progress) => set((state) => ({
    player: { ...state.player, progress },
  })),

  setDuration: (duration) => set((state) => ({
    player: { ...state.player, duration },
  })),

  // `auto` = true quando chamado pelo fim natural da faixa (evento "ended"
  // do <audio>); `auto` = false (padrão) quando o usuário clica em "próxima".
  // Isso permite que "repetir desligado" realmente pare no fim da fila em
  // vez de sempre dar a volta, enquanto o botão "próxima" continua pulando
  // livremente mesmo com repeat desligado.
  nextTrack: (auto = false) => {
    const state = get();
    if (state.queue.length === 0) return;

    let nextIndex: number;

    if (state.shuffleEnabled && state.queue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * state.queue.length);
      } while (nextIndex === state.queueIndex);
    } else {
      nextIndex = state.queueIndex + 1;
      if (nextIndex >= state.queue.length) {
        if (auto && state.repeatMode !== 'all') {
          // Chegou ao fim da fila sem repetição habilitada: para de tocar
          // em vez de simular um loop que não existe de verdade.
          set({ player: { ...state.player, isPlaying: false } });
          return;
        }
        nextIndex = 0;
      }
    }

    const nextTrack = state.queue[nextIndex];
    set({
      player: {
        ...state.player,
        currentTrack: nextTrack,
        isPlaying: true,
        progress: 0,
      },
      queueIndex: nextIndex,
    });
  },

  prevTrack: () => {
    const state = get();
    if (state.queue.length === 0) return;
    const prevIndex = state.queueIndex === 0 ? state.queue.length - 1 : state.queueIndex - 1;
    const prevTrack = state.queue[prevIndex];
    set({
      player: {
        ...state.player,
        currentTrack: prevTrack,
        isPlaying: true,
        progress: 0,
      },
      queueIndex: prevIndex,
    });
  },

  setVolume: (volume) => set((state) => ({
    player: { ...state.player, volume },
  })),

  toggleShuffle: () => set((state) => ({ shuffleEnabled: !state.shuffleEnabled })),

  cycleRepeatMode: () => set((state) => ({
    repeatMode:
      state.repeatMode === 'off' ? 'all' :
      state.repeatMode === 'all' ? 'one' : 'off',
  })),

  // Chat actions
  selectConversation: (id, name) => set({
    selectedConversationId: id,
    selectedConversationName: name,
  }),

  // Artist profile actions
  selectArtist: (id) => set((state) => ({
    selectedArtistId: id,
    previousScreen: state.currentScreen,
    currentScreen: 'artist',
  })),

  // Social actions
  setLikes: (likes) => set({ likes }),
  toggleLike: (trackId) => set((state) => {
    const exists = state.likes.some(l => l.track_id === trackId);
    if (exists) {
      return { likes: state.likes.filter(l => l.track_id !== trackId) };
    }
    return {
      likes: [...state.likes, {
        id: `like-${Date.now()}`,
        user_id: state.user?.id || '',
        track_id: trackId,
        created_at: new Date().toISOString(),
      }],
    };
  }),
  setComments: (comments) => set({ comments }),
  addComment: (comment) => set((state) => ({
    comments: [...state.comments, comment],
  })),

  // Favorites actions
  initFavorites: () => set({ favorites: loadFavorites() }),
  toggleFavorite: (trackId) => set((state) => {
    const exists = state.favorites.includes(trackId);
    const next = exists
      ? state.favorites.filter((id) => id !== trackId)
      : [...state.favorites, trackId];
    saveFavorites(next);
    return { favorites: next };
  }),
  isFavorite: (trackId) => {
    return get().favorites.includes(trackId);
  },
}));
