import { create } from 'zustand';
import type { User, Track, Screen, Message, Comment, Like } from '@/types';
import { getAuthToken, getStoredUser, saveAuth, clearAuth } from '@/lib/api';

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

  // Player
  player: PlayerState;
  queue: Track[];
  queueIndex: number;

  // Chat
  selectedConversationId: string | null;
  selectedConversationName: string | null;

  // Social
  likes: Like[];
  comments: Comment[];

  // Actions - Auth
  setUser: (user: User | null, token?: string | null) => void;
  logout: () => void;
  restoreSession: () => void;

  // Actions - Navigation
  navigate: (screen: Screen) => void;
  goBack: () => void;

  // Actions - Player
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (volume: number) => void;

  // Actions - Chat
  selectConversation: (id: string, name: string) => void;

  // Actions - Social
  setLikes: (likes: Like[]) => void;
  toggleLike: (trackId: string) => void;
  setComments: (comments: Comment[]) => void;
  addComment: (comment: Comment) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  authToken: getAuthToken(),
  currentScreen: 'login',
  previousScreen: null,
  selectedConversationId: null,
  selectedConversationName: null,
  likes: [],
  comments: [],

  player: {
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    duration: 0,
    volume: 0.8,
  },

  queue: [],
  queueIndex: 0,

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
  navigate: (screen) => set((state) => ({
    previousScreen: state.currentScreen,
    currentScreen: screen,
  })),

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

  nextTrack: () => {
    const state = get();
    if (state.queue.length === 0) return;
    const nextIndex = (state.queueIndex + 1) % state.queue.length;
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

  // Chat actions
  selectConversation: (id, name) => set({
    selectedConversationId: id,
    selectedConversationName: name,
  }),

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
}));
