'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { audioEngine } from '@/lib/audioEngine';
import { registerServiceWorker } from '@/lib/registerServiceWorker';
import { sendHeartbeat } from '@/lib/api';
import { HEARTBEAT_INTERVAL_MS } from '@/lib/presence';
import { DEMO_COMMENTS } from '@/lib/demo-data';
import LoginScreen from '@/components/zoada/LoginScreen';
import MainScreen from '@/components/zoada/MainScreen';
import PlayerScreen from '@/components/zoada/PlayerScreen';
import ProfileScreen from '@/components/zoada/ProfileScreen';
import ArtistProfileScreen from '@/components/zoada/ArtistProfileScreen';
import ChatScreen from '@/components/zoada/ChatScreen';
import BottomNav from '@/components/zoada/BottomNav';
import MiniPlayer from '@/components/zoada/MiniPlayer';

export default function Home() {
  const { currentScreen, isAuthenticated, user, setComments, restoreSession, initFavorites, loadLikes, loadFollows } = useAppStore();

  // Restore auth session from localStorage on mount
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    initFavorites();
  }, [initFavorites]);

  // Carrega as curtidas reais do usuário a partir do servidor assim que
  // ele estiver autenticado (antes disso não temos user.id pra buscar).
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadLikes(user.id);
      loadFollows(user.id);
    }
  }, [isAuthenticated, user?.id, loadLikes, loadFollows]);

  // Load demo comments on mount
  useEffect(() => {
    setComments(DEMO_COMMENTS);
  }, [setComments]);

  // Registra o service worker e ativa o fluxo de aviso de atualização
  // (ver src/lib/registerServiceWorker.ts).
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Heartbeat de presença: avisa o servidor "estou online agora" enquanto
  // o app estiver aberto e o usuário logado. Sem isso, o status "online"
  // seria só decoração — aqui ele reflete atividade real e recente.
  useEffect(() => {
    if (!isAuthenticated) return;

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Manda um heartbeat extra quando a aba volta a ficar visível, pra
    // não esperar até 45s pra "reaparecer" online depois de um tempo
    // com a aba em segundo plano.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated]);

  // Media Session API setup
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const updateMediaSession = () => {
      const state = useAppStore.getState();
      const { currentTrack, isPlaying } = state.player;

      if (!currentTrack) return;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist_name,
        album: 'Zôada',
        artwork: [
          {
            src: currentTrack.cover_url || '/zoada-logo.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        useAppStore.getState().togglePlay();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        useAppStore.getState().togglePlay();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        useAppStore.getState().prevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        useAppStore.getState().nextTrack();
      });
    };

    // Subscribe to store changes
    const unsub1 = useAppStore.subscribe(() => updateMediaSession());
    updateMediaSession();

    return unsub1;
  }, []);

  // Motor de áudio real (HTML5 Audio) — toca de fato o audio_url da faixa,
  // em vez de simular o progresso com um timer falso.
  useEffect(() => {
    if (!isAuthenticated) return;
    audioEngine.init();
  }, [isAuthenticated]);

  // Render current screen
  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen />;
      case 'main':
        return <MainScreen />;
      case 'player':
        return <PlayerScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'artist':
        return <ArtistProfileScreen />;
      case 'chat':
      case 'chat-conversation':
        return <ChatScreen />;
      default:
        return <MainScreen />;
    }
  };

  const showNav = isAuthenticated && currentScreen !== 'login' && currentScreen !== 'player';
  const showMiniPlayer = isAuthenticated && currentScreen !== 'login' && currentScreen !== 'player';

  return (
    <main className="min-h-screen bg-[#F7F7FB] relative overflow-x-hidden">
      {/* Screen content */}
      <div className={showNav && !showMiniPlayer ? 'pb-20' : showMiniPlayer ? 'pb-36' : ''}>
        {renderScreen()}
      </div>

      {/* Mini Player */}
      {showMiniPlayer && <MiniPlayer />}

      {/* Bottom Navigation */}
      {showNav && <BottomNav />}
    </main>
  );
}
