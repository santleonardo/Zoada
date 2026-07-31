import { create } from 'zustand';
import type { User, Track, Screen, Message, Comment, RadioComment, Like, Follow, RadioTab, RadioStation } from '@/types';
import { getAuthToken, getStoredUser, saveAuth, clearAuth, registerTrackPlay, fetchUserLikes, toggleTrackLike, fetchTrackComments, postTrackComment, fetchRadioComments, postRadioComment, fetchUserFollows, toggleArtistFollow, updateMyProfile, fetchPublishedRadioStations, fetchRadioStationById, advanceRadioStation } from '@/lib/api';

// Abas da tela inicial ("Início"). 'fans' é a busca de outros usuários
// por nome — sem conteúdo próprio na store, é só mais uma aba client-side
// igual 'favorites'.
export type MainTab = 'tracks' | 'artists' | 'favorites' | 'fans';

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

// Embaralha uma lista de IDs (Fisher-Yates). Usado para sortear cada novo
// "embrulho" do shuffle bag do rádio — dá uma distribuição realmente
// uniforme, diferente de `.sort(() => Math.random() - 0.5)`, que é
// enviesado (favorece certas posições dependendo do algoritmo de sort do
// motor JS).
function shuffleIds(ids: string[]): string[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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
  mainTab: MainTab;

  // Player
  player: PlayerState;
  queue: Track[];
  queueIndex: number;
  shuffleEnabled: boolean;
  // IDs das faixas que ainda faltam tocar no "embrulho" atual de shuffle
  // (shuffle bag). Cada faixa só sai daqui uma vez; quando esvazia, um
  // embrulho novo é sorteado com todas as faixas de novo. Isso garante que
  // nenhuma faixa repete antes de todas as outras terem tocado — diferente
  // de sortear um índice aleatório a cada vez, que pode repetir faixas
  // seguidas vezes por puro acaso (mais chance ainda quanto mais tempo o
  // rádio fica tocando).
  shuffleBag: string[];
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
  // Chat geral da rádio (comentários sem vínculo com faixa nenhuma)
  radioComments: RadioComment[];
  follows: Follow[];

  // Favorites
  favorites: string[]; // track IDs

  // Radio
  radioEnabled: boolean;
  radioTab: RadioTab;
  // Lista de estações publicadas disponíveis no seletor.
  publishedStations: RadioStation[];
  // ID da estação selecionada pelo ouvinte (null = estação padrão Zôada).
  // Cada usuário escolhe sua estação independentemente.
  selectedStationId: string | null;
  // Dados completos da estação selecionada (com faixas), carregados
  // sob demanda quando o usuário seleciona uma estação no dial.
  selectedStation: RadioStation | null;

  // Actions - Auth
  setUser: (user: User | null, token?: string | null) => void;
  logout: () => void;
  restoreSession: () => void;
  // Atualiza nome/foto do usuário logado no servidor e reflete no estado
  // local (sem navegar de tela, diferente de setUser). Retorna true em
  // caso de sucesso.
  updateProfile: (fields: { name: string; avatar_url: string | null }) => Promise<boolean>;

  // Actions - Navigation
  navigate: (screen: Screen, tab?: MainTab) => void;
  goBack: () => void;
  setMainTab: (tab: MainTab) => void;

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
  // Chat geral da rádio: busca/envia comentários que não são de nenhuma faixa
  loadRadioComments: () => Promise<void>;
  sendRadioComment: (content: string) => Promise<boolean>;
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
  // Busca estações publicadas do servidor.
  loadPublishedStations: () => Promise<void>;
  // Seleciona uma estação pelo ID (null = volta pra estação padrão Zôada).
  selectStation: (stationId: string | null) => Promise<void>;
  // Sintoniza e já começa a tocar uma estação publicada (usado a partir de
  // fora da tela de Rádio, ex: ranking "mais tocadas" da Início). Busca a
  // estação com as faixas, monta a fila e inicia o player nela.
  tuneIntoStation: (stationId: string) => Promise<void>;
  // Avança a faixa atual da estação selecionada no servidor (fire-and-forget).
  advanceStationTrack: () => Promise<void>;
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
  radioComments: [],
  follows: [],
  favorites: [],

  radioEnabled: false,
  radioTab: 'faixas',
  publishedStations: [],
  selectedStationId: null,
  selectedStation: null,

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
  shuffleBag: [],
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
      shuffleBag: [],
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

  updateProfile: async (fields) => {
    try {
      const updated = await updateMyProfile({ name: fields.name, avatarUrl: fields.avatar_url });
      if (!updated) return false;

      // Atualiza o estado local com o que o servidor confirmou (não com
      // `fields` diretamente), pra manter a store sempre em sincronia com
      // o que foi realmente persistido.
      set((state) => ({
        user: state.user ? { ...state.user, name: updated.name, avatar_url: updated.avatar_url } : state.user,
      }));

      // Mantém o localStorage sincronizado (usado pelo restoreSession).
      const token = getAuthToken();
      if (token) {
        saveAuth(token, {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          avatar_url: updated.avatar_url,
        });
      }

      return true;
    } catch {
      return false;
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
    let nextShuffleBag = state.shuffleBag;

    if (state.shuffleEnabled && state.queue.length > 1) {
      const currentId = state.queue[state.queueIndex]?.id;

      // Embrulho vazio (primeira vez ou todas as faixas dele já tocaram):
      // sorteia um embrulho novo com TODAS as faixas da fila.
      let bag = state.shuffleBag;
      if (bag.length === 0) {
        bag = shuffleIds(state.queue.map((t) => t.id));
      }

      // Evita que a faixa atual seja logo a primeira do embrulho novo (o
      // que soaria como "repetiu direto"), trocando com a segunda posição
      // quando isso acontece e há uma alternativa disponível.
      let pickId = bag[0];
      let rest = bag.slice(1);
      if (pickId === currentId && rest.length > 0) {
        pickId = rest[0];
        rest = [bag[0], ...rest.slice(1)];
      }

      nextShuffleBag = rest;
      const foundIndex = state.queue.findIndex((t) => t.id === pickId);
      nextIndex = foundIndex >= 0 ? foundIndex : 0;
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
      shuffleBag: nextShuffleBag,
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

  toggleShuffle: () => set((state) => {
    const enabling = !state.shuffleEnabled;
    if (!enabling) {
      // Desligando: o embrulho não tem mais serventia até religar.
      return { shuffleEnabled: false, shuffleBag: [] };
    }
    // Ligando: sorteia um embrulho novo, excluindo a faixa que já está
    // tocando agora (ela só volta a poder ser sorteada depois que todas
    // as outras tiverem tocado).
    const currentId = state.queue[state.queueIndex]?.id;
    const bag = shuffleIds(state.queue.map((t) => t.id).filter((id) => id !== currentId));
    return { shuffleEnabled: true, shuffleBag: bag };
  }),

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

  // Busca o chat geral da rádio (independe de qual faixa está tocando).
  loadRadioComments: async () => {
    const serverComments = await fetchRadioComments();
    set({ radioComments: serverComments });
  },

  // Envia um comentário geral da rádio: atualiza a tela na hora (otimista)
  // e persiste no servidor, desfazendo se a chamada falhar de verdade.
  sendRadioComment: async (content) => {
    const user = get().user;
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: RadioComment = {
      id: tempId,
      user_id: user?.id || '',
      content,
      created_at: new Date().toISOString(),
      user: user || undefined,
    };

    set((state) => ({ radioComments: [...state.radioComments, optimisticComment] }));

    const result = await postRadioComment(content);

    if (!result) {
      set((state) => ({ radioComments: state.radioComments.filter((c) => c.id !== tempId) }));
      return false;
    }

    set((state) => ({
      radioComments: state.radioComments.map((c) => (c.id === tempId ? result : c)),
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
    const startingTrack = shuffled[randomIndex];
    set({
      radioEnabled: true,
      shuffleEnabled: true,
      repeatMode: 'all', // Radio loops forever
      queue: shuffled,
      queueIndex: randomIndex,
      // Embrulho inicial já sorteado, sem a faixa que acabou de começar a
      // tocar — ela só volta a ser candidata depois que as demais tiverem
      // tocado uma vez cada.
      shuffleBag: shuffleIds(shuffled.map((t) => t.id).filter((id) => id !== startingTrack.id)),
      player: {
        ...get().player,
        currentTrack: startingTrack,
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

  // Busca todas as estações publicadas do servidor e guarda na lista.
  loadPublishedStations: async () => {
    const stations = await fetchPublishedRadioStations();
    set({ publishedStations: stations });
  },

  // Seleciona uma estação para ouvir. Se stationId for null, volta pra
  // estação padrão (shuffle Zôada). Carrega os dados completos da estação
  // (com faixas) do servidor, calcula o progresso e atualiza o player.
  selectStation: async (stationId) => {
    if (!stationId) {
      // Volta pra estação padrão — o RadioScreen vai detectar a mudança
      // e re-iniciar o shuffle.
      set({ selectedStationId: null, selectedStation: null });
      return;
    }

    // Busca dados completos da estação (com faixas)
    const station = await fetchRadioStationById(stationId);
    if (!station || !station.tracks || station.tracks.length === 0) {
      // Falhou ou estação sem faixas — volta pra padrão.
      set({ selectedStationId: null, selectedStation: null });
      return;
    }

    set({ selectedStationId: stationId, selectedStation: station });
  },

  // Sintoniza uma estação publicada e já coloca ela tocando, montando a
  // fila e o player diretamente — mesma lógica que o dial da tela de Rádio
  // usa ao trocar de estação, só que acionável de qualquer lugar do app
  // (ex: card do ranking "estações mais tocadas" na Início).
  tuneIntoStation: async (stationId) => {
    const station = await fetchRadioStationById(stationId);
    if (!station || !station.tracks || station.tracks.length === 0) return;

    const stationTracks = station.tracks;

    // Calcula qual faixa deveria estar tocando agora, pra entrar já
    // sincronizado com quem mais estiver ouvindo essa estação.
    let startIndex = 0;
    if (station.current_track_started_at && station.current_track_id) {
      const startedAt = new Date(station.current_track_started_at).getTime();
      const elapsedMs = Date.now() - startedAt;
      let accumulated = 0;
      for (let i = 0; i < stationTracks.length; i++) {
        accumulated += (stationTracks[i].duration || 0) * 1000;
        if (accumulated > elapsedMs) {
          startIndex = i;
          break;
        }
        if (i === stationTracks.length - 1) startIndex = i;
      }
    }

    const startingTrack = stationTracks[startIndex];
    const state = get();
    set({
      selectedStationId: stationId,
      selectedStation: station,
      radioEnabled: true,
      shuffleEnabled: false,
      repeatMode: 'all',
      queue: stationTracks,
      queueIndex: startIndex,
      shuffleBag: [],
      player: {
        ...state.player,
        currentTrack: startingTrack,
        isPlaying: true,
        progress: 0,
      },
    });
  },

  // Avança a faixa atual da estação selecionada no servidor. Chamado
  // (fire-and-forget) quando o player chega ao fim de uma faixa.
  advanceStationTrack: async () => {
    const stationId = get().selectedStationId;
    if (!stationId) return;
    const updated = await advanceRadioStation();
    if (updated) {
      set({ selectedStation: updated });
    }
  },
}));
