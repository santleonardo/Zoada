'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, UserPlus, Heart, MessageCircle, CheckCheck, Bell } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { formatRelativeTime } from '@/lib/utils';
import type { Notification } from '@/types';

// Ícone + cor por tipo de notificação — mesma paleta usada no resto do
// app (laranja/roxo/rosa da marca), pra cada tipo ter uma identidade
// visual rápida de reconhecer numa lista.
function iconFor(type: Notification['type']) {
  switch (type) {
    case 'follow':
    case 'artist_follow':
      return { Icon: UserPlus, bg: 'bg-[#6C5CE7]/10', color: 'text-[#6C5CE7]' };
    case 'post_like':
    case 'comment_like':
      return { Icon: Heart, bg: 'bg-[#E84393]/10', color: 'text-[#E84393]' };
    case 'post_comment':
      return { Icon: MessageCircle, bg: 'bg-[#FF8C42]/10', color: 'text-[#FF8C42]' };
    default:
      return { Icon: Bell, bg: 'bg-black/5', color: 'text-black/50' };
  }
}

function textFor(n: Notification): string {
  switch (n.type) {
    case 'follow':
      return `${n.actor.name} começou a seguir você`;
    case 'artist_follow':
      return `${n.actor.name} começou a seguir ${n.artist_name || 'seu artista'}`;
    case 'post_like':
      return `${n.actor.name} curtiu sua postagem`;
    case 'post_comment':
      return `${n.actor.name} comentou na sua postagem`;
    case 'comment_like':
      return `${n.actor.name} curtiu seu comentário`;
    default:
      return `${n.actor.name} interagiu com você`;
  }
}

/**
 * Central de notificações: segue você, curtiu/comentou numa postagem sua,
 * curtiu um comentário seu. Busca a lista do servidor ao abrir e marca
 * como lida individualmente (ao tocar) ou tudo de uma vez.
 */
const NotificationsScreen: React.FC = () => {
  const {
    goBack,
    notifications,
    unreadNotificationsCount,
    notificationPrefs,
    loadNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    selectUser,
    selectArtist,
    navigate,
  } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    loadNotifications().finally(() => setIsLoading(false));
  }, [loadNotifications]);

  // Respeita as preferências definidas em Perfil > Configurações >
  // Notificações — tipo desligado não aparece na lista.
  const visibleNotifications = notifications.filter((n) => notificationPrefs[n.type]);

  const handleOpen = (n: Notification) => {
    if (!n.read) markNotificationAsRead(n.id);

    switch (n.type) {
      case 'follow':
        selectUser(n.actor.id);
        break;
      case 'artist_follow':
        if (n.artist_id) selectArtist(n.artist_id);
        else selectUser(n.actor.id);
        break;
      case 'post_like':
      case 'post_comment':
      case 'comment_like':
        // Ainda não existe uma tela de postagem isolada — leva pro
        // próprio perfil, onde o feed (UserFeedPanel) mostra a postagem.
        navigate('profile');
        break;
    }
  };

  const initialsFor = (name: string) =>
    (name || '?')
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={goBack}
          className="p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={22} className="text-[#1A1B25]" />
        </button>
        <h1 className="text-xl font-bold text-[#1A1B25] flex-1">Notificações</h1>
        {unreadNotificationsCount > 0 && (
          <button
            onClick={() => markAllNotificationsAsRead()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 hover:bg-black/10 text-xs font-medium text-black/60 transition-colors"
          >
            <CheckCheck size={13} />
            Marcar todas
          </button>
        )}
      </div>

      {isLoading && (
        <p className="text-black/40 text-sm text-center py-16">Carregando...</p>
      )}

      {!isLoading && visibleNotifications.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mx-auto mb-3">
            <Bell size={24} className="text-black/25" />
          </div>
          <p className="text-black/50 text-sm">
            {notifications.length > 0 ? 'Nenhuma notificação com os tipos ativados.' : 'Nenhuma notificação ainda.'}
          </p>
          <p className="text-black/30 text-xs mt-1">
            {notifications.length > 0
              ? 'Você desligou alguns tipos em Perfil > Configurações > Notificações.'
              : 'Quando alguém interagir com você, aparece aqui.'}
          </p>
        </div>
      )}

      {!isLoading && visibleNotifications.length > 0 && (
        <div className="space-y-1">
          {visibleNotifications.map((n) => {
            const { Icon, bg, color } = iconFor(n.type);
            return (
              <button
                key={n.id}
                onClick={() => handleOpen(n)}
                className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-colors ${
                  n.read ? 'bg-transparent hover:bg-black/5' : 'bg-[#FF8C42]/[0.06] hover:bg-[#FF8C42]/10'
                }`}
              >
                {/* Avatar do ator + selo do tipo de ação */}
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full overflow-hidden gradient-bg flex items-center justify-center">
                    {n.actor.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.actor.avatar_url} alt={n.actor.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-white">{initialsFor(n.actor.name)}</span>
                    )}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${bg} border-2 border-white flex items-center justify-center`}>
                    <Icon size={11} className={color} fill={n.type === 'post_like' || n.type === 'comment_like' ? 'currentColor' : 'none'} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1A1B25] leading-snug">
                    <span className="font-semibold">{n.actor.name}</span>
                    {textFor(n).slice(n.actor.name.length)}
                  </p>
                  {n.type === 'post_comment' && n.comment_preview && (
                    <p className="text-xs text-black/40 mt-0.5 line-clamp-1">&ldquo;{n.comment_preview}&rdquo;</p>
                  )}
                  <p className="text-[11px] text-black/35 mt-1">{formatRelativeTime(n.created_at)}</p>
                </div>

                {!n.read && (
                  <div className="w-2 h-2 rounded-full bg-[#FF8C42] flex-shrink-0 mt-2" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsScreen;
