'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { audioEngine } from '@/lib/audioEngine';
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
  const { currentScreen, isAuthenticated, setComments, restoreSession, initFavorites } = useAppStore();

  // Restore auth session from localStorage on mount
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    initFavorites();
  }, [initFavorites]);

  // Load demo comments on mount
  useEffect(() => {
    setComments(DEMO_COMMENTS);
  }, [setComments]);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed (expected in dev)
      });
    }
  }, []);

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
