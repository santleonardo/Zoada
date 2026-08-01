'use client';

import React from 'react';
import { X, Check, Zap, Gauge, Leaf } from 'lucide-react';
import { useAppStore, type AudioQuality } from '@/store/useAppStore';

interface AudioQualityDialogProps {
  open: boolean;
  onClose: () => void;
}

const OPTIONS: {
  value: AudioQuality;
  icon: React.ReactNode;
  title: string;
  description: string;
}[] = [
  {
    value: 'high',
    icon: <Zap size={18} />,
    title: 'Alta qualidade',
    description: 'Toca a versão original enviada pelo artista. Melhor som, mais dados.',
  },
  {
    value: 'auto',
    icon: <Gauge size={18} />,
    title: 'Automático (recomendado)',
    description: 'Toca em alta qualidade, mas só baixa aos poucos. Bom equilíbrio pro dia a dia.',
  },
  {
    value: 'saver',
    icon: <Leaf size={18} />,
    title: 'Economizar dados',
    description: 'Toca uma versão em bitrate mais baixo (quando disponível), pra gastar menos internet.',
  },
];

const AudioQualityDialog: React.FC<AudioQualityDialogProps> = ({ open, onClose }) => {
  const { audioQuality, setAudioQuality } = useAppStore();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-[#F7F7FB] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <h2 className="text-lg font-bold text-[#1A1B25]">Qualidade de áudio</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <X size={16} className="text-black/50" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          {OPTIONS.map((option) => {
            const selected = audioQuality === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setAudioQuality(option.value)}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-colors ${
                  selected
                    ? 'bg-[#FF8C42]/10 border-[#FF8C42]'
                    : 'bg-white border-black/10 hover:bg-[#F2F2F8]'
                }`}
              >
                <span
                  className={`mt-0.5 flex-shrink-0 ${
                    selected ? 'text-[#FF8C42]' : 'text-black/40'
                  }`}
                >
                  {option.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1A1B25]">{option.title}</p>
                  <p className="text-xs text-black/40 mt-0.5">{option.description}</p>
                </div>
                {selected && (
                  <Check size={18} className="text-[#FF8C42] flex-shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}

          <p className="text-xs text-black/25 pt-1">
            A preferência é salva neste aparelho e vale já na música em execução. Faixas enviadas antes
            desta função ainda não têm versão economia — nesse caso, tocam em alta qualidade mesmo assim.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AudioQualityDialog;
