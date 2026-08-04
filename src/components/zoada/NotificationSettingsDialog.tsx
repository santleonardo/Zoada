'use client';

import React from 'react';
import { X, UserPlus, Heart, MessageCircle } from 'lucide-react';
import { useAppStore, type NotificationPrefType } from '@/store/useAppStore';

interface NotificationSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const OPTIONS: {
  type: NotificationPrefType;
  icon: React.ReactNode;
  title: string;
  description: string;
}[] = [
  {
    type: 'follow',
    icon: <UserPlus size={18} />,
    title: 'Novos seguidores',
    description: 'Quando alguém começa a seguir o seu perfil.',
  },
  {
    type: 'artist_follow',
    icon: <UserPlus size={18} />,
    title: 'Seguidores de artista',
    description: 'Quando alguém começa a seguir um artista seu.',
  },
  {
    type: 'post_like',
    icon: <Heart size={18} />,
    title: 'Curtidas em postagens',
    description: 'Quando alguém curte uma postagem sua.',
  },
  {
    type: 'post_comment',
    icon: <MessageCircle size={18} />,
    title: 'Comentários',
    description: 'Quando alguém comenta numa postagem sua.',
  },
  {
    type: 'comment_like',
    icon: <Heart size={18} />,
    title: 'Curtidas em comentários',
    description: 'Quando alguém curte um comentário seu.',
  },
];

/**
 * Configurações de notificação: liga/desliga o que aparece na central de
 * notificações (sino). É uma preferência local (por aparelho) — quem
 * segue/curte/comenta continua gerando o evento no servidor normalmente,
 * isto só controla o que a própria pessoa vê chegar.
 */
const NotificationSettingsDialog: React.FC<NotificationSettingsDialogProps> = ({ open, onClose }) => {
  const { notificationPrefs, setNotificationPref } = useAppStore();

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
          <h2 className="text-lg font-bold text-[#1A1B25]">Notificações</h2>
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
            const enabled = notificationPrefs[option.type];
            return (
              <div
                key={option.type}
                className="flex items-center justify-between w-full p-4 rounded-xl bg-white border border-black/10 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-black/50 flex-shrink-0">{option.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1A1B25]">{option.title}</p>
                    <p className="text-xs text-black/40 mt-0.5">{option.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={option.title}
                  onClick={() => setNotificationPref(option.type, !enabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    enabled ? 'bg-[#FF8C42]' : 'bg-black/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}

          <p className="text-xs text-black/25 pt-1">
            A preferência é salva neste aparelho e controla só o que aparece na sua central de
            notificações — não afeta o que os outros recebem sobre suas ações.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsDialog;
