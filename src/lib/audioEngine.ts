'use client';

import { useAppStore } from '@/store/useAppStore';

// ============================================================
// Motor de áudio real (HTML5 Audio) sincronizado com o store.
// Antes, o "progresso" da música era só um número incrementado
// por um setInterval falso — nenhum som de fato tocava.
// Agora existe um <audio> de verdade por baixo dos panos.
// ============================================================

type PlayerState = ReturnType<typeof useAppStore.getState>['player'];

class AudioEngine {
  private audio: HTMLAudioElement | null = null;
  private loadedTrackId: string | null = null;
  private initialized = false;
  // true quando a reprodução ATUAL da faixa carregada já foi contabilizada
  // no servidor. Zerado sempre que uma faixa nova é carregada (ou quando
  // "repetir uma" reinicia a mesma faixa do zero).
  private playCounted = false;

  init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    const audio = new Audio();
    audio.preload = 'metadata';
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
      this.sync(state.player, prevState.player);
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

  private sync(player: PlayerState, prev: PlayerState) {
    const audio = this.audio;
    if (!audio) return;

    // Trocou de faixa -> carrega nova fonte
    if (player.currentTrack?.id !== this.loadedTrackId) {
      this.loadedTrackId = player.currentTrack?.id ?? null;
      // Faixa nova (ou a mesma sendo recarregada do zero, ex: tocada de
      // novo depois de ter saído da fila) começa sem contagem registrada.
      this.playCounted = false;

      if (player.currentTrack?.audio_url) {
        audio.src = player.currentTrack.audio_url;
        audio.currentTime = 0;
        audio.load();
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
