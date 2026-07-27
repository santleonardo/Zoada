'use client';

import React from 'react';
import { Home, Disc3, MessageCircle, User } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { Screen } from '@/types';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  screen: Screen;
}

const navItems: NavItem[] = [
  { icon: <Home size={22} />, label: 'Início', screen: 'main' },
  { icon: <Disc3 size={22} />, label: 'Explorar', screen: 'main' },
  { icon: <MessageCircle size={22} />, label: 'Chat', screen: 'chat' },
  { icon: <User size={22} />, label: 'Perfil', screen: 'profile' },
];

const BottomNav: React.FC = () => {
  const { currentScreen, navigate, player } = useAppStore();
  const hasActiveTrack = !!player.currentTrack;

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 glass',
        'border-t border-white/5',
        'safe-bottom',
        hasActiveTrack && 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]'
      )}
      role="navigation"
      aria-label="Navegação principal"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive =
            item.screen === 'chat'
              ? currentScreen === 'chat' || currentScreen === 'chat-conversation'
              : item.screen === 'profile'
              ? currentScreen === 'profile'
              : currentScreen === 'main';

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.screen)}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 no-select',
                isActive
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/70'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={cn('transition-transform duration-200', isActive && 'scale-110')}>
                {item.icon}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="w-1 h-1 rounded-full gradient-bg mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
