'use client';

import React from 'react';
import { Send, Trash2 } from 'lucide-react';
import { cn, formatRecordingTime } from '@/lib/utils';

/**
 * Barra que substitui o campo de texto/postagem enquanto uma mensagem ou
 * postagem de voz está sendo gravada: botão de cancelar, cronômetro e
 * botão de enviar. Usado tanto no chat quanto no mural do clube.
 */
const VoiceRecordingBar: React.FC<{
  seconds: number;
  maxSeconds: number;
  onCancel: () => void;
  onSend: () => void;
}> = ({ seconds, maxSeconds, onCancel, onSend }) => {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onCancel}
        className="p-3 rounded-xl bg-red-50 flex-shrink-0 active:scale-90 transition-all"
        aria-label="Cancelar gravação"
        title="Cancelar"
      >
        <Trash2 size={18} className="text-red-500" />
      </button>
      <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#F2F2F8]">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            seconds >= maxSeconds - 10 ? 'text-red-500' : 'text-[#1A1B25]'
          )}
        >
          {formatRecordingTime(seconds)} / {formatRecordingTime(maxSeconds)}
        </span>
        <span className="text-xs text-black/30 ml-auto">Gravando áudio...</span>
      </div>
      <button
        onClick={onSend}
        className="p-3 rounded-xl gradient-bg flex-shrink-0 active:scale-90 transition-all"
        aria-label="Enviar mensagem de voz"
        title="Enviar"
      >
        <Send size={18} className="text-white" />
      </button>
    </div>
  );
};

export default VoiceRecordingBar;
