'use client';

import { useAppStore } from '@/store/useAppStore';

// ============================================================
// Motor de áudio real (HTML5 Audio) sincronizado com o store.
// Antes, o "progresso" da música era só um número incrementado
// por um setInterval falso — nenhum som de fato tocava.
// Agora existe um <audio> de verdade por baixo dos panos.
// ============================================================

type PlayerState = ReturnType<typeof useAppStore.getState>['player'];
type AudioQuality = ReturnType<typeof useAppStore.getState>['audioQuality'];
type Track = NonNullable<PlayerState['currentTrack']>;

// Mapeia a preferência de qualidade pro atributo `preload` do <audio>:
// 'high' baixa a faixa inteira ao carregar, 'saver' só baixa quando o
// usuário dá play, 'auto' fica no meio-termo (só metadados adiantados).
function preloadForQuality(quality: AudioQuality): 'auto' | 'metadata' | 'none' {
  if (quality === 'high') return 'auto';
  if (quality === 'saver') return 'none';
  return 'metadata';
}

/**
 * Escolhe qual arquivo tocar de fato: em modo "economia de dados", usa a
 * versão em bitrate mais baixo (audio_url_low) gerada no upload — quando
 * ela existe. Faixas enviadas antes dessa funcionalidade existir (ou cujo
 * navegador de quem enviou não conseguiu gerar a versão economia) não têm
 * audio_url_low, então caem de volta pra versão em alta qualidade mesmo
 * assim, em vez de não tocar nada.
 */
function resolveUrl(track: Track | null, quality: AudioQuality): string | null {
  if (!track) return null;
  if (quality === 'saver' && track.audio_url_low) return track.audio_url_low;
  return track.audio_url || track.audio_url_low || null;
}

class AudioEngine {
  private audio: HTMLAudioElement | null = null;
  private loadedTrackId: string | null = null;
  // Guarda a URL efetivamente carregada (não só o id da faixa), porque
  // mudar a preferência de qualidade no meio da mesma faixa também precisa
  // trocar o arquivo tocado, mesmo sem trocar de música.
  private loadedUrl: string | null = null;
  private initialized = false;
  // true quando a reprodução ATUAL da faixa carregada já foi contabilizada
  // no servidor. Zerado sempre que uma faixa nova é carregada (ou quando
  // "repetir uma" reinicia a mesma faixa do zero).
  private playCounted = false;

  init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    const audio = new Audio();
    audio.preload = preloadForQuality(useAppStore.getState().audioQuality);
    this.audio = audio;

    audio.addEventListener('timeupdate', () => {
      useAppStore.getState().setProgress(audio.currentTime);
      this.maybeCountPlay(audio.currentTime, audio.duration);
    });

    audio.addEventListener('loadedmetadata', () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        useAppStore.getState().setDuration(audio.duration);
      }
    });

    audio.addEventListener('ended', () => {
      const { repeatMode } = useAppStore.getState();
      if (repeatMode === 'one') {
        // Repetir uma: volta pro início e toca de novo, em vez de pular.
        // Isso é uma nova "escuta" da mesma faixa, então zera o contador
        // pra ela poder ser contabilizada de novo ao passar do limiar.
        this.playCounted = false;
        audio.currentTime = 0;
        useAppStore.getState().setProgress(0);
        audio.play().catch((err) => console.warn('[audioEngine] play() falhou:', err));
        return;
      }
      // auto=true: respeita "sem repetição" parando no fim da fila.
      useAppStore.getState().nextTrack(true);
    });

    audio.addEventListener('error', () => {
      const track = useAppStore.getState().player.currentTrack;
      console.warn(
        `[audioEngine] Não foi possível carregar o áudio da faixa "${track?.title ?? ''}". ` +
        `Verifique se audio_url aponta para um arquivo de áudio válido e acessível (CORS/URL pública).`
      );
    });

    audio.volume = useAppStore.getState().player.volume;

    // Reage a qualquer mudança no player (track, play/pause, volume)
    useAppStore.subscribe((state, prevState) => {
      this.sync(state.player, state.audioQuality, prevState.player);
    });

    // Reage a mudanças na preferência de qualidade de áudio (tela de
    // Configurações > "Qualidade de áudio"), mesmo quando a faixa em si
    // não mudou — troca o arquivo tocado (alta <-> economia) preservando
    // a posição atual, e ajusta o `preload` pra valer nas próximas faixas.
    useAppStore.subscribe((state, prevState) => {
      if (state.audioQuality === prevState.audioQuality) return;
      const a = this.audio;
      if (!a) return;
      a.preload = preloadForQuality(state.audioQuality);
      this.sync(state.player, state.audioQuality, state.player);
    });
  }

  /**
   * Conta uma reprodução só depois que a faixa tocou de verdade por um
   * tempo mínimo — nunca no clique inicial. Isso evita inflar o número
   * com gente pulando rápido entre músicas ou cliques acidentais, do
   * mesmo jeito que serviços de streaming reais fazem. O limiar é 30s ou
   * metade da faixa, o que vier primeiro (com um piso de 15s caso a
   * duração ainda não tenha sido carregada).
   */
  private maybeCountPlay(currentTime: number, duration: number) {
    if (this.playCounted) return;
    const trackId = useAppStore.getState().player.currentTrack?.id;
    if (!trackId) return;

    const threshold = isFinite(duration) && duration > 0 ? Math.min(30, duration / 2) : 15;
    if (currentTime >= threshold) {
      this.playCounted = true;
      useAppStore.getState().registerPlay(trackId);
    }
  }

  private sync(player: PlayerState, quality: AudioQuality, prev: PlayerState) {
    const audio = this.audio;
    if (!audio) return;

    const trackChanged = player.currentTrack?.id !== this.loadedTrackId;
    const targetUrl = resolveUrl(player.currentTrack, quality);
    const urlChanged = targetUrl !== this.loadedUrl;

    // Trocou de faixa OU trocou a versão a tocar (alta <-> economia) ->
    // carrega a nova fonte, preservando a posição quando é só a versão
    // que mudou (mesma faixa, mesmo ponto de escuta).
    if (trackChanged || urlChanged) {
      const resumeAt = trackChanged ? 0 : audio.currentTime;
      this.loadedTrackId = player.currentTrack?.id ?? null;
      this.loadedUrl = targetUrl;

      // Faixa nova começa sem contagem registrada. Só trocar a versão
      // (mesma faixa) não reinicia a contagem — é a mesma escuta.
      if (trackChanged) this.playCounted = false;

      if (targetUrl) {
        audio.src = targetUrl;
        audio.load();
        if (resumeAt > 0) audio.currentTime = resumeAt;
        if (player.isPlaying) {
          audio.play().catch((err) => console.warn('[audioEngine] play() falhou:', err));
        }
      } else {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      return;
    }

    // Play / pause
    if (player.isPlaying !== prev.isPlaying) {
      if (player.isPlaying) {
        audio.play().catch((err) => console.warn('[audioEngine] play() falhou:', err));
      } else {
        audio.pause();
      }
    }

    // Volume
    if (player.volume !== prev.volume) {
      audio.volume = player.volume;
    }
  }

  /** Pula para um tempo específico (segundos), usado pela barra de progresso. */
  seek(seconds: number) {
    if (this.audio && this.audio.src) {
      this.audio.currentTime = seconds;
    }
    useAppStore.getState().setProgress(seconds);
  }
}

export const audioEngine = new AudioEngine();
