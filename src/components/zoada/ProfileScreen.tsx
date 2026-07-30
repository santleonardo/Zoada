'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  LogOut,
  ChevronRight,
  Flame,
  Music2,
  Camera,
  Edit3,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { TopListenedTrack } from '@/types';
import { fetchTopListenedTracks } from '@/lib/api';
import GradientButton from './GradientButton';
import CoverArt from './CoverArt';
import Equalizer from './Equalizer';
import UploadMusicPanel from './UploadMusicPanel';
import MyTracksPanel from './MyTracksPanel';
import MyArtistsPanel from './MyArtistsPanel';

const ProfileScreen: React.FC = () => {
  const { user, logout, navigate, selectArtist } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [tracksRefreshKey, setTracksRefreshKey] = useState(0);
  const [artistsRefreshKey, setArtistsRefreshKey] = useState(0);
  const [topTracks, setTopTracks] = useState<TopListenedTrack[]>([]);

  // Busca as músicas que o usuário mais repetiu (contador pessoal de
  // reproduções), já ordenadas da mais ouvida pra menos ouvida.
  useEffect(() => {
    fetchTopListenedTracks(10).then(setTopTracks);
  }, []);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold gradient-text">Perfil</h1>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 hover:bg-black/10 transition-colors text-black/60 hover:text-black/80 text-sm"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl bg-white shadow-sm p-6 mb-6 text-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, #FF8C42, transparent)' }}
          />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, #6C5CE7, transparent)' }}
          />
        </div>

        <div className="relative z-10">
          {/* Avatar */}
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden gradient-bg flex items-center justify-center pulse-glow">
              <span className="text-3xl font-bold text-white">{initials}</span>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#EFF0F6] border-2 border-white shadow-sm flex items-center justify-center hover:bg-[#E4E5EE] transition-colors"
              aria-label="Editar perfil"
            >
              {isEditing ? (
                <Check size={14} className="text-[#1A1B25]" />
              ) : (
                <Camera size={14} className="text-black/60" />
              )}
            </button>
          </div>

          {/* Name */}
          {isEditing ? (
            <div className="flex items-center justify-center gap-2 mb-1">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="!text-center !text-lg !font-bold !py-1 !px-4 max-w-[200px]"
              />
            </div>
          ) : (
            <h2 className="text-xl font-bold text-[#1A1B25] mb-1">{user.name}</h2>
          )}

          <p className="text-black/40 text-sm">{user.email}</p>
        </div>
      </div>

      {/* Mais ouvidas: top 10 músicas que o usuário mais repetiu, da mais
          pra menos ouvida (ex: 15x aparece antes de uma ouvida 10x). */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-[#FF8C42]" fill="#FF8C42" />
            <h3 className="text-lg font-semibold text-[#1A1B25]">Mais Ouvidas</h3>
          </div>
          <span className="text-sm text-black/40">{topTracks.length} faixas</span>
        </div>

        {topTracks.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
            <Music2 size={40} className="text-black/15 mx-auto mb-3" />
            <p className="text-black/40 text-sm">Nenhuma música ouvida repetidamente ainda</p>
            <button
              onClick={() => navigate('main')}
              className="mt-3 text-sm text-[#FF8C42] hover:text-[#FFB074] transition-colors"
            >
              Explorar músicas →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {topTracks.map((track, index) => (
              <div
                key={track.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm hover:bg-[#F2F2F8] transition-colors cursor-pointer group"
              >
                <span className="w-5 text-center text-sm font-bold text-black/25 flex-shrink-0">
                  {index + 1}
                </span>
                <CoverArt
                  title={track.title}
                  artistName={track.artist_name}
                  coverUrl={track.cover_url}
                  size="sm"
                  className="!w-12 !h-12 !max-w-none !rounded-lg flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1A1B25] truncate">{track.title}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (track.artist_id) selectArtist(track.artist_id);
                    }}
                    className="text-xs text-black/40 hover:text-[#FF8C42] hover:underline transition-colors truncate block text-left"
                  >
                    {track.artist_name}
                  </button>
                </div>
                <span className="text-xs text-black/40 flex-shrink-0">
                  {track.listen_count}x
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suas músicas enviadas (seção separada, só listagem/apagar) */}
      <MyTracksPanel refreshKey={tracksRefreshKey} />

      {/* Upload de músicas novas */}
      <UploadMusicPanel
        userName={user.name}
        onUploaded={() => setTracksRefreshKey((k) => k + 1)}
        refreshKey={artistsRefreshKey}
      />

      {/* Seus artistas: seção própria, separada do envio/edição, só para
          apagar artista(s) — ação destrutiva que não deve ficar misturada
          com o formulário de upload. */}
      <MyArtistsPanel
        refreshKey={artistsRefreshKey}
        onArtistDeleted={() => {
          setArtistsRefreshKey((k) => k + 1);
          setTracksRefreshKey((k) => k + 1);
        }}
      />

      {/* Settings */}
      <div className="space-y-2 mb-6">
        <h3 className="text-lg font-semibold text-[#1A1B25] mb-3">Configurações</h3>
        {[
          { icon: <Settings size={18} />, label: 'Notificações' },
          { icon: <Music2 size={18} />, label: 'Qualidade de áudio' },
          { icon: <Edit3 size={18} />, label: 'Editar perfil' },
        ].map((item) => (
          <button
            key={item.label}
            className="flex items-center justify-between w-full p-3 rounded-xl bg-white shadow-sm hover:bg-[#F2F2F8] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-black/50">{item.icon}</span>
              <span className="text-sm text-[#1A1B25]">{item.label}</span>
            </div>
            <ChevronRight size={16} className="text-black/25" />
          </button>
        ))}
      </div>

      {/* Bottom spacing */}
      <div className="h-32" />
    </div>
  );
};

// Simple check icon component
function Check({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default ProfileScreen;
