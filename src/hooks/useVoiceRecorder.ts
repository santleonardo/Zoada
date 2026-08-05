'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { uploadVoiceMessage } from '@/lib/trackUpload';

export type VoiceRecordingState = 'idle' | 'recording' | 'uploading';

interface UseVoiceRecorderOptions {
  // Identifica o "contexto" atual (id da conversa, do clube...). Trocar
  // essa chave — ou desmontar o componente — interrompe uma gravação em
  // andamento sem enviar nada, pra não deixar o microfone preso aberto.
  resetKey?: string | null;
  // Duração máxima da gravação, em segundos. Ao chegar nesse limite, a
  // gravação para e é enviada automaticamente.
  maxSeconds?: number;
  // Chamado depois que o áudio já foi gravado e subido pro R2, com a url e
  // a duração em segundos. Deve criar a mensagem/postagem correspondente e
  // devolver true/false conforme o envio deu certo (pra decidir o toast de
  // erro genérico do hook).
  onRecorded: (url: string, durationSeconds: number) => Promise<boolean> | boolean;
  // Bloqueia o início de uma nova gravação (ex: usuário bloqueado no chat).
  disabled?: boolean;
}

/**
 * Encapsula a gravação de mensagens de voz pelo microfone do navegador
 * (getUserMedia + MediaRecorder) e o upload do áudio resultante. É o mesmo
 * mecanismo usado nas conversas, extraído aqui pra poder ser reaproveitado
 * em qualquer outro lugar que precise de gravação de áudio (ex: mural do
 * clube).
 */
export function useVoiceRecorder({ resetKey, maxSeconds = 60, onRecorded, disabled }: UseVoiceRecorderOptions) {
  const [voiceState, setVoiceState] = useState<VoiceRecordingState>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingSecondsRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRecordingRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  // Libera o microfone e para o cronômetro — chamado tanto ao cancelar
  // quanto ao terminar de gravar (com sucesso ou erro).
  const stopRecordingStreamAndTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  // Para de gravar (se estiver gravando) sem enviar nada, ao trocar de
  // contexto (conversa, clube...) ou sair da tela.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      stopRecordingStreamAndTimer();
    };
  }, [resetKey]);

  const startRecording = async () => {
    if (disabled || voiceState !== 'idle') return;

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Seu navegador não suporta gravação de áudio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = preferredTypes.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.start();

      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      stoppingRecordingRef.current = false;
      setVoiceState('recording');
      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
        if (recordingSecondsRef.current >= maxSeconds) {
          // Bateu o limite — para e envia sozinho, sem precisar que o
          // usuário toque em nada.
          stopAndSendRecording();
        }
      }, 1000);
    } catch {
      toast.error('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null; // não dispara envio nenhum, só descarta
      recorder.stop();
    }
    stopRecordingStreamAndTimer();
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;
    setVoiceState('idle');
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    stoppingRecordingRef.current = false;
  };

  const stopAndSendRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive' || stoppingRecordingRef.current) return;
    stoppingRecordingRef.current = true;
    const finalSeconds = recordingSecondsRef.current;

    recorder.onstop = async () => {
      stopRecordingStreamAndTimer();
      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;

      // Gravação vazia demais (ex: soltou o dedo sem gravar nada) — não
      // vale a pena subir e criar uma mensagem/postagem quase em branco.
      if (blob.size < 500) {
        setVoiceState('idle');
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
        stoppingRecordingRef.current = false;
        return;
      }

      setVoiceState('uploading');
      try {
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voz-${Date.now()}.${ext}`, { type: mimeType });
        const url = await uploadVoiceMessage(file);
        const ok = await onRecordedRef.current(url, finalSeconds);
        if (!ok) {
          toast.error('Não foi possível enviar o áudio.');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Falha ao enviar o áudio.');
      } finally {
        setVoiceState('idle');
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
        stoppingRecordingRef.current = false;
      }
    };

    recorder.stop();
  };

  return {
    voiceState,
    recordingSeconds,
    maxSeconds,
    startRecording,
    cancelRecording,
    stopAndSendRecording,
  };
}
