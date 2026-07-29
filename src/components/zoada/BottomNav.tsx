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
  tab?: 'tracks' | 'artists';
}

const navItems: NavItem[] = [
  { icon: <Home size={18} />, label: 'Início', screen: 'main', tab: 'tracks' },
  { icon: <Disc3 size={18} />, label: 'Explorar', screen: 'main', tab: 'artists' },
  { icon: <MessageCircle size={18} />, label: 'Chat', screen: 'chat' },
  { icon: <User size={18} />, label: 'Perfil', screen: 'profile' },
];

const BottomNav: React.FC = () => {
  const { currentScreen, mainTab, navigate, player } = useAppStore();
  const hasActiveTrack = !!player.currentTrack;

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 glass',
        'border-t border-black/5',
        'safe-bottom',
        hasActiveTrack && 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]'
      )}
      role="navigation"
      aria-label="Navegação principal"
    >
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive =
            item.screen === 'chat'
              ? currentScreen === 'chat' || currentScreen === 'chat-conversation'
              : item.screen === 'profile'
              ? currentScreen === 'profile'
              : item.tab
              ? currentScreen === 'main' && mainTab === item.tab
              : currentScreen === 'main';

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.screen, item.tab)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 no-select',
                isActive
                  ? 'text-[#FF8C42]'
                  : 'text-black/35 hover:text-black/65'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={cn('transition-transform duration-200', isActive && 'scale-110')}>
                {item.icon}
              </div>
              <span className="text-[9px] font-medium">{item.label}</span>
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
