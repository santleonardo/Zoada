import { create } from 'zustand';
import type { User, Track, Screen, Message, Comment, Like, Follow, RadioTab } from '@/types';
import { getAuthToken, getStoredUser, saveAuth, clearAuth, registerTrackPlay, fetchUserLikes, toggleTrackLike, fetchTrackComments, postTrackComment, fetchUserFollows, toggleArtistFollow } from '@/lib/api';

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
  // Última reprodução contabilizada de verdade (ver audioEngine.ts): outras
  // telas que mantêm sua própria lista local de faixas (MainScreen,
  // ArtistProfileScreen) observam isso pra atualizar o número exibido sem
  // precisar recarregar a página.
  lastCountedPlay: { trackId: string; nonce: number } | null;

  // Chat
  selectedConversationId: string | null;
  selectedConversationName: string | null;
  // Nome do artista/playlist que originou essa conversa (ex: você clicou
  // em "Mensagem" no perfil do artista "DJ Thunder", cujo dono real é
  // "João Silva"). Mostrado como legenda menor embaixo do nome do dono
  // real na tela de conversa, pra deixar claro que a mensagem vai pra
  // pessoa, não pro "personagem". Fica null quando a conversa não veio
  // de um perfil de artista (ex: nova conversa direta com um usuário).
  selectedConversationContext: string | null;

  // Artist profile (perfil público de um artista)
  selectedArtistId: string | null;

  // User profile (perfil público de outro usuário — ex: quem comentou
  // numa faixa, ou quem é dono de um artista)
  selectedUserId: string | null;

  // Social
  likes: Like[];
  comments: Comment[];
  follows: Follow[];

  // Favorites
  favorites: string[]; // track IDs

  // Radio
  radioEnabled: boolean;
  radioTab: RadioTab;

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
  // Contabiliza uma reprodução real (chamado pelo audioEngine depois que a
  // faixa tocou por um tempo mínimo): atualiza o contador otimisticamente
  // na tela e envia pro servidor persistir.
  registerPlay: (trackId: string) => void;

  // Actions - Chat
  selectConversation: (id: string, name: string, context?: string | null) => void;
  closeConversation: () => void;

  // Actions - Artist profile
  selectArtist: (id: string) => void;

  // Actions - User profile
  selectUser: (id: string) => void;

  // Actions - Social
  setLikes: (likes: Like[]) => void;
  loadLikes: (userId: string) => Promise<void>;
  toggleLike: (trackId: string) => Promise<void>;
  setComments: (comments: Comment[]) => void;
  loadComments: (trackId: string) => Promise<void>;
  addComment: (comment: Comment) => void;
  sendComment: (trackId: string, content: string) => Promise<boolean>;
  loadFollows: (userId: string) => Promise<void>;
  // Segue/deixa de seguir um artista; retorna o followers_count real vindo
  // do servidor (ou null se a chamada falhou) para a tela ajustar o número
  // exibido sem precisar recarregar tudo.
  toggleFollow: (artistId: string) => Promise<number | null>;
  isFollowingArtist: (artistId: string) => boolean;

  // Actions - Favorites
  toggleFavorite: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;
  initFavorites: () => void;

  // Actions - Radio
  startRadio: (tracks: Track[]) => void;
  stopRadio: () => void;
  setRadioTab: (tab: RadioTab) => void;
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
  selectedConversationContext: null,
  selectedArtistId: null,
  selectedUserId: null,
  likes: [],
  comments: [],
  follows: [],
  favorites: [],

  radioEnabled: false,
  radioTab: 'faixas',

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
  lastCountedPlay: null,
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

  registerPlay: (trackId) => {
    const state = get();

    // Atualiza o contador na hora, na tela (otimista): tanto na faixa
    // tocando agora quanto na fila, se ela estiver lá — pra quem está
    // olhando o player veja o número subir no mesmo instante em que a
    // reprodução foi contabilizada, sem esperar um recarregamento.
    set({
      player:
        state.player.currentTrack?.id === trackId
          ? {
              ...state.player,
              currentTrack: {
                ...state.player.currentTrack,
                plays_count: state.player.currentTrack.plays_count + 1,
              },
            }
          : state.player,
      queue: state.queue.map((t) =>
        t.id === trackId ? { ...t, plays_count: t.plays_count + 1 } : t
      ),
      // nonce garante que o efeito dispara mesmo se a mesma faixa for
      // contada de novo em seguida (ex: repetir uma música)
      lastCountedPlay: { trackId, nonce: Date.now() + Math.random() },
    });

    // Persiste no servidor — não precisa aguardar nem travar a UI por isso.
    registerTrackPlay(trackId);
  },

  cycleRepeatMode: () => set((state) => ({
    repeatMode:
      state.repeatMode === 'off' ? 'all' :
      state.repeatMode === 'all' ? 'one' : 'off',
  })),

  // Chat actions
  selectConversation: (id, name, context = null) => set({
    selectedConversationId: id,
    selectedConversationName: name,
    selectedConversationContext: context,
  }),

  // Fecha a conversa aberta de verdade — sem isso o app fica preso na
  // mesma conversa pra sempre, porque só currentScreen mudava, nunca
  // selectedConversationId.
  closeConversation: () => set({
    selectedConversationId: null,
    selectedConversationName: null,
    selectedConversationContext: null,
  }),

  // Artist profile actions
  selectArtist: (id) => set((state) => ({
    selectedArtistId: id,
    previousScreen: state.currentScreen,
    currentScreen: 'artist',
  })),

  // User profile actions
  selectUser: (id) => set((state) => ({
    selectedUserId: id,
    previousScreen: state.currentScreen,
    currentScreen: 'user-profile',
  })),

  // Social actions
  setLikes: (likes) => set({ likes }),

  // Busca as curtidas reais do usuário no servidor e substitui o estado local.
  loadLikes: async (userId) => {
    const likes = await fetchUserLikes(userId);
    set({ likes });
  },

  // Curte/descurte uma faixa: atualiza a tela na hora (otimista) e persiste
  // de verdade no servidor. Se a chamada falhar, desfaz a mudança local pra
  // não deixar o usuário achando que curtiu algo que não foi salvo.
  toggleLike: async (trackId) => {
    const before = get().likes;
    const exists = before.some(l => l.track_id === trackId);
    const userId = get().user?.id || '';

    // Atualização otimista
    if (exists) {
      set({ likes: before.filter(l => l.track_id !== trackId) });
    } else {
      set({
        likes: [...before, {
          id: `temp-${Date.now()}`,
          user_id: userId,
          track_id: trackId,
          created_at: new Date().toISOString(),
        }],
      });
    }

    const result = await toggleTrackLike(trackId);

    if (!result) {
      // Falhou de verdade (rede caiu, não autenticado, etc.) — desfaz.
      set({ likes: before });
      return;
    }

    // Sincroniza com o dado real vindo do servidor (id definitivo, etc.)
    if (result.liked && result.like) {
      const serverLike = result.like;
      set((state) => ({
        likes: state.likes.map(l => (l.track_id === trackId && l.id.startsWith('temp-')) ? serverLike : l),
      }));
    }
  },
  setComments: (comments) => set({ comments }),

  // Busca os comentários reais de uma faixa no servidor e substitui o estado local.
  loadComments: async (trackId) => {
    const serverComments = await fetchTrackComments(trackId);
    set((state) => ({
      // Mantém comentários de OUTRAS faixas já carregadas, substitui só os desta.
      comments: [
        ...state.comments.filter((c) => c.track_id !== trackId),
        ...serverComments,
      ],
    }));
  },

  addComment: (comment) => set((state) => ({
    comments: [...state.comments, comment],
  })),

  // Envia um comentário de verdade: atualiza a tela na hora (otimista) e
  // persiste no servidor. Se falhar, desfaz a mudança local para não deixar
  // o usuário achando que o comentário foi salvo quando não foi.
  sendComment: async (trackId, content) => {
    const user = get().user;
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: Comment = {
      id: tempId,
      user_id: user?.id || '',
      track_id: trackId,
      content,
      created_at: new Date().toISOString(),
      user: user || undefined,
    };

    set((state) => ({ comments: [...state.comments, optimisticComment] }));

    const result = await postTrackComment(trackId, content);

    if (!result) {
      // Falhou de verdade (rede caiu, não autenticado, etc.) — desfaz.
      set((state) => ({ comments: state.comments.filter((c) => c.id !== tempId) }));
      return false;
    }

    // Sincroniza com o dado real vindo do servidor (id definitivo, etc.)
    set((state) => ({
      comments: state.comments.map((c) => (c.id === tempId ? result : c)),
    }));
    return true;
  },

  // Busca os artistas que o usuário realmente segue no servidor e
  // substitui o estado local.
  loadFollows: async (userId) => {
    const follows = await fetchUserFollows(userId);
    set({ follows });
  },

  // Segue/deixa de seguir um artista: atualiza a tela na hora (otimista) e
  // persiste de verdade no servidor. Se a chamada falhar, desfaz a mudança
  // local pra não deixar o usuário achando que seguiu alguém que não foi
  // salvo — igual ao toggleLike.
  toggleFollow: async (artistId) => {
    const before = get().follows;
    const exists = before.some((f) => f.artist_id === artistId);
    const userId = get().user?.id || '';

    // Atualização otimista
    if (exists) {
      set({ follows: before.filter((f) => f.artist_id !== artistId) });
    } else {
      set({
        follows: [...before, {
          id: `temp-${Date.now()}`,
          user_id: userId,
          artist_id: artistId,
          created_at: new Date().toISOString(),
        }],
      });
    }

    const result = await toggleArtistFollow(artistId);

    if (!result) {
      // Falhou de verdade (rede caiu, não autenticado, etc.) — desfaz.
      set({ follows: before });
      return null;
    }

    // Sincroniza com o dado real vindo do servidor (id definitivo, etc.)
    if (result.following && result.follow) {
      const serverFollow = result.follow;
      set((state) => ({
        follows: state.follows.map((f) =>
          f.artist_id === artistId && f.id.startsWith('temp-') ? serverFollow : f
        ),
      }));
    }

    return result.followers_count;
  },

  isFollowingArtist: (artistId) => {
    return get().follows.some((f) => f.artist_id === artistId);
  },

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

  // Radio actions
  startRadio: (tracks) => {
    if (tracks.length === 0) return;
    // Shuffle the tracks array randomly
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    const randomIndex = Math.floor(Math.random() * shuffled.length);
    set({
      radioEnabled: true,
      shuffleEnabled: true,
      repeatMode: 'all', // Radio loops forever
      queue: shuffled,
      queueIndex: randomIndex,
      player: {
        ...get().player,
        currentTrack: shuffled[randomIndex],
        isPlaying: true,
        progress: 0,
      },
    });
  },

  stopRadio: () => {
    set({
      radioEnabled: false,
      player: {
        ...get().player,
        isPlaying: false,
      },
    });
  },

  setRadioTab: (tab) => set({ radioTab: tab }),
}));
