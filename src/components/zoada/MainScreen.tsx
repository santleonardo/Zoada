'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, TrendingUp, Play, Music2, Star, Flame } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_TRACKS, DEMO_ARTISTS, COVER_COLORS } from '@/lib/demo-data';
import type { Track, Artist } from '@/types';
import CoverArt from './CoverArt';
import Equalizer from './Equalizer';
import { cn, formatNumber } from '@/lib/utils';

type Tab = 'tracks' | 'artists' | 'favorites';

const MainScreen: React.FC = () => {
  const { playTrack, player, selectArtist, mainTab: activeTab, setMainTab: setActiveTab, favorites, toggleFavorite, lastCountedPlay } = useAppStore();
  const [search, setSearch] = useState('');
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS);
  const [artists, setArtists] = useState<Artist[]>(DEMO_ARTISTS);

  // Mantém o número de reproduções exibido em sincronia assim que uma
  // reprodução é contabilizada de verdade (ver audioEngine.ts), sem
  // precisar recarregar a lista inteira da API.
  useEffect(() => {
    if (!lastCountedPlay) return;
    setTracks((prev) =>
      prev.map((t) => (t.id === lastCountedPlay.trackId ? { ...t, plays_count: t.plays_count + 1 } : t))
    );
  }, [lastCountedPlay]);

  // Busca faixas e artistas reais da API
  useEffect(() => {
    fetch('/api/tracks')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.tracks) && data.tracks.length > 0) setTracks(data.tracks);
      })
      .catch(() => {
        // mantém os dados demo se a API falhar
      });

    fetch('/api/artists')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.artists) && data.artists.length > 0) setArtists(data.artists);
      })
      .catch(() => {
        // mantém os dados demo se a API falhar
      });
  }, []);

  const favoriteTracks = useMemo(() => {
    return tracks.filter((t) => favorites.includes(t.id));
  }, [tracks, favorites]);

  const filteredTracks = useMemo(() => {
    if (!search) return tracks;
    const q = search.toLowerCase();
    return tracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist_name.toLowerCase().includes(q)
    );
  }, [search, tracks]);

  const filteredFavoriteTracks = useMemo(() => {
    if (!search) return favoriteTracks;
    const q = search.toLowerCase();
    return favoriteTracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist_name.toLowerCase().includes(q)
    );
  }, [search, favoriteTracks]);

  const filteredArtists = useMemo(() => {
    if (!search) return artists;
    const q = search.toLowerCase();
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [search, artists]);

  // Top 10 por número de reproduções — só faz sentido mostrar na aba de
  // faixas, sem busca ativa (é uma vitrine fixa, não um resultado filtrado).
  const topTracks = useMemo(() => {
    return [...tracks]
      .sort((a, b) => b.plays_count - a.plays_count)
      .slice(0, 10);
  }, [tracks]);

  // Artistas mais populares = maior soma de reproduções entre todas as
  // faixas dele (não é o mesmo que "seguidores"). Fica logo abaixo da
  // vitrine "Mais tocadas", como um segundo destaque na tela inicial.
  const topArtists = useMemo(() => {
    const playsByArtist = new Map<string, number>();
    tracks.forEach((t) => {
      if (!t.artist_id) return;
      playsByArtist.set(t.artist_id, (playsByArtist.get(t.artist_id) || 0) + t.plays_count);
    });
    return artists
      .map((a) => ({ ...a, totalPlays: playsByArtist.get(a.id) || 0 }))
      .filter((a) => a.totalPlays > 0)
      .sort((a, b) => b.totalPlays - a.totalPlays)
      .slice(0, 5);
  }, [artists, tracks]);

  const handlePlayTrack = (track: Track) => {
    playTrack(track, activeTab === 'favorites' ? favoriteTracks : filteredTracks);
  };

  const handleToggleFavorite = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    toggleFavorite(trackId);
  };

  // Leva pro perfil do artista a partir de uma faixa (cartão de música,
  // vitrine "mais tocadas", etc.) — sem isso só dava pra chegar no perfil
  // pela aba "Artistas". stopPropagation evita que o clique também dispare
  // o play da faixa, já que esse botão fica dentro do cartão clicável.
  const handleGoToArtist = (e: React.MouseEvent, artistId: string) => {
    e.stopPropagation();
    selectArtist(artistId);
  };

  // Acentos por posição no ranking de artistas: ouro/prata/bronze pra quem
  // chegou no pódio, cinza neutro pro resto — a mesma linguagem visual de
  // uma parada de sucessos, sem precisar escrever "1º", "2º" por extenso.
  const RANK_ACCENTS: Record<number, string> = {
    2: 'linear-gradient(135deg, #E4E7ED, #9AA0B4)',
    3: 'linear-gradient(135deg, #E3A86B, #B9713A)',
  };
  const RANK_FALLBACK = 'linear-gradient(135deg, #C7CAD6, #9498A8)';

  // Capa de fundo do cartão de artista: mesmo esquema de cores determinístico
  // das faixas, mas usando a capa (ou avatar, se não houver capa) do artista.
  const renderArtistBackdrop = (artist: Artist) => {
    const hash = artist.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = COVER_COLORS[hash % COVER_COLORS.length];
    const img = artist.cover_url || artist.avatar_url;
    return (
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>
    );
  };

  // Cartão em destaque do 1º colocado: uma faixa horizontal com a capa do
  // artista ao fundo e um numeral gigante e translúcido — o mesmo tipo de
  // "hero" que a vitrine de faixas usa, mas com identidade própria (ouro,
  // não laranja) pra deixar claro que é outro tipo de ranking.
  const renderTopArtistHero = (artist: Artist & { totalPlays: number }) => (
    <button
      onClick={() => selectArtist(artist.id)}
      className="group relative w-full aspect-square rounded-3xl overflow-hidden text-left active:scale-[0.98] transition-transform duration-200 mb-3"
    >
      {renderArtistBackdrop(artist)}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(10,8,20,0.05) 35%, rgba(10,8,20,0.92) 100%)' }}
      />

      {/* Numeral decorativo — reforça a leitura de "ranking" sem precisar de mais texto */}
      <span
        aria-hidden="true"
        className="absolute -right-4 -bottom-10 font-black leading-none select-none text-white/[0.08]"
        style={{ fontSize: 180 }}
      >
        1
      </span>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Flame size={12} className="text-[#FDCB6E]" fill="#FDCB6E" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#FDCB6E]">
            Nº1 mais tocado
          </span>
        </div>
        <p className="text-white font-bold text-lg truncate">{artist.name}</p>
        <div className="flex items-center gap-1.5 mt-2">
          {artist.genre && (
            <span className="text-[11px] text-white/70 bg-white/10 px-2 py-0.5 rounded-full truncate max-w-[130px]">
              {artist.genre}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-white/55 font-medium">
            <TrendingUp size={11} />
            {formatNumber(artist.totalPlays)} reproduções
          </span>
        </div>
      </div>
    </button>
  );

  // Cartões do 2º ao 5º lugar: mesma linguagem "foto de fundo + texto por
  // cima" dos cartões de faixa (bento/"Em alta"), só que com o selo de
  // posição no lugar do botão de play — assim a seção pesa visualmente
  // tanto quanto as vitrines de música ao redor, em vez de parecer uma
  // lista secundária.
  const renderArtistRankCard = (artist: Artist & { totalPlays: number }, rank: number) => (
    <button
      key={artist.id}
      onClick={() => selectArtist(artist.id)}
      className="group relative rounded-2xl overflow-hidden text-left active:scale-[0.97] transition-transform duration-200 aspect-square"
    >
      {renderArtistBackdrop(artist)}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(10,8,20,0.05) 38%, rgba(10,8,20,0.88) 100%)' }}
      />

      <div
        className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-2 ring-white/80 z-10"
        style={{ background: RANK_ACCENTS[rank] || RANK_FALLBACK }}
      >
        {rank}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-white text-[11px] font-semibold leading-tight truncate">{artist.name}</p>
        <div className="flex items-center gap-1 mt-1">
          <TrendingUp size={9} className="text-[#FDCB6E] flex-shrink-0" />
          <span className="text-[9px] text-white/60 font-medium">{formatNumber(artist.totalPlays)}</span>
        </div>
      </div>
    </button>
  );



  // Capa que preenche 100% do cartão bento (sem os tamanhos fixos do
  // CoverArt), com fallback em gradiente igual ao resto do app.
  const renderBentoCover = (track: Track) => {
    const hash = track.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = COVER_COLORS[hash % COVER_COLORS.length];
    return (
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${colors[0]}dd, ${colors[1]}dd)` }}
      >
        {track.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.cover_url}
            alt={`Capa de ${track.title}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>
    );
  };

  // Cartão individual do bento. `variant` controla o quanto de
  // informação/tamanho de fonte cabe em cada tamanho de cartão
  // (hero > medium > small).
  const renderBentoTile = (
    track: Track,
    variant: 'hero' | 'medium' | 'small',
    style: React.CSSProperties
  ) => {
    const isCurrentTrack = player.currentTrack?.id === track.id;
    const isFav = favorites.includes(track.id);

    return (
      <button
        key={track.id}
        onClick={() => playTrack(track, topTracks)}
        style={style}
        className={cn(
          'group relative aspect-square rounded-2xl overflow-hidden text-left active:scale-[0.97] transition-transform duration-200',
          isCurrentTrack && 'ring-2 ring-[#FF8C42] shadow-lg shadow-[#FF8C42]/30'
        )}
      >
        {renderBentoCover(track)}

        {/* Overlay escuro pra garantir legibilidade do texto sobre a capa */}
        <div
          className="absolute inset-0"
          style={{
            background:
              variant === 'small'
                ? 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.75) 100%)'
                : 'linear-gradient(180deg, rgba(15,17,23,0.05) 40%, rgba(15,17,23,0.92) 100%)',
          }}
        />

        {/* Play overlay no hover */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div
            className={cn(
              'rounded-full gradient-bg flex items-center justify-center shadow-xl',
              variant === 'hero' ? 'w-14 h-14' : variant === 'medium' ? 'w-11 h-11' : 'w-9 h-9'
            )}
          >
            <Play
              size={variant === 'small' ? 16 : variant === 'medium' ? 20 : 26}
              className="text-white ml-0.5"
              fill="white"
            />
          </div>
        </div>

        {/* Favoritar */}
        {variant !== 'small' && (
          <button
            onClick={(e) => handleToggleFavorite(e, track.id)}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors z-10"
            aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Star
              size={16}
              className={cn('transition-all duration-200', isFav ? 'fill-[#FFD700] text-[#FFD700]' : 'text-white/70')}
            />
          </button>
        )}

        {/* Tocando agora */}
        {isCurrentTrack && player.isPlaying && (
          <div className={cn('absolute z-10', variant === 'small' ? 'top-2 right-2' : 'top-2.5 right-2.5')}>
            <div className="flex items-center gap-1 px-1.5 py-1 rounded-full glass">
              <Equalizer barCount={3} height={variant === 'small' ? 9 : 11} barWidth={2} gap={1} />
            </div>
          </div>
        )}

        {/* Texto */}
        <div className={cn('absolute bottom-0 left-0 right-0', variant === 'small' ? 'p-2.5' : variant === 'medium' ? 'p-3' : 'p-3.5')}>
          <p
            className={cn(
              'font-semibold text-white leading-tight',
              variant === 'hero' ? 'text-lg' : variant === 'medium' ? 'text-[11px]' : 'text-[10px]',
              variant === 'small' ? 'line-clamp-1' : 'line-clamp-2'
            )}
          >
            {track.title}
          </p>
          {variant !== 'small' && (
            <button
              type="button"
              onClick={(e) => track.artist_id && handleGoToArtist(e, track.artist_id)}
              className={cn('block text-white/50 truncate mt-0.5 hover:text-white/80 hover:underline transition-colors text-left', variant === 'medium' ? 'text-[10px]' : 'text-sm')}
            >
              {track.artist_name}
            </button>
          )}
          {variant === 'hero' && (
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp size={12} className="text-[#FF8C42]" />
              <span className="text-sm font-medium text-white/60">{formatNumber(track.plays_count)} reproduções</span>
            </div>
          )}
          {variant === 'medium' && (
            <div className="flex items-center gap-1 mt-0.5">
              <TrendingUp size={9} className="text-[#FF8C42]" />
              <span className="text-[9px] font-medium text-white/45">{formatNumber(track.plays_count)}</span>
            </div>
          )}
        </div>
      </button>
    );
  };

  // Monta o grid bento com as faixas mais tocadas: 1 cartão hero em
  // destaque, até 2 cartões médios ao lado e uma fileira de cartões
  // pequenos abaixo — dá muito mais peso visual do que uma lista.
  const renderMostPlayedBento = () => {
    const heroTrack = topTracks[0];
    const restTracks = topTracks.slice(1, 7);
    if (!heroTrack) return null;

    return (
      <div className="space-y-3.5">
        <div className="-mx-4">{renderBentoTile(heroTrack, 'hero', {})}</div>
        {restTracks.length > 0 && (
          <div className="grid grid-cols-2 gap-3.5">
            {restTracks.map((track) => renderBentoTile(track, 'medium', {}))}
          </div>
        )}
      </div>
    );
  };

  const renderTrackCard = (track: Track, displayTracks: Track[]) => {
    const isCurrentTrack = player.currentTrack?.id === track.id;
    const isFav = favorites.includes(track.id);
    return (
      <button
        key={track.id}
        onClick={() => handlePlayTrack(track)}
        className={cn(
          'relative rounded-2xl overflow-hidden text-left transition-all duration-200 active:scale-[0.97]',
          isCurrentTrack && 'ring-2 ring-[#FF8C42] shadow-lg shadow-[#FF8C42]/20'
        )}
      >
        <CoverArt
          title={track.title}
          artistName={track.artist_name}
          coverUrl={track.cover_url}
          size="lg"
        />
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center shadow-xl">
            <Play size={22} className="text-white ml-0.5" fill="white" />
          </div>
        </div>
        {/* Playing indicator */}
        {isCurrentTrack && player.isPlaying && (
          <div className="absolute top-2 right-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full glass">
              <Equalizer barCount={3} height={12} barWidth={2} gap={1} />
            </div>
          </div>
        )}
        {/* Favorite button */}
        <button
          onClick={(e) => handleToggleFavorite(e, track.id)}
          className="absolute top-2 left-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors z-10"
          aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Star
            size={16}
            className={cn(
              'transition-all duration-200',
              isFav ? 'fill-[#FFD700] text-[#FFD700]' : 'text-white/70'
            )}
          />
        </button>
        {/* Info bar */}
        <div className="p-3 pt-0 -mt-3 relative">
          <div className="bg-white shadow-sm rounded-b-2xl px-3 py-2.5">
            <p className="text-sm font-semibold text-[#1A1B25] truncate">{track.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={(e) => track.artist_id && handleGoToArtist(e, track.artist_id)}
                className="text-xs text-black/40 hover:text-[#FF8C42] hover:underline transition-colors truncate"
              >
                {track.artist_name}
              </button>
              <span className="text-black/20">·</span>
              <div className="flex items-center gap-1">
                <TrendingUp size={10} className="text-black/30" />
                <span className="text-xs text-black/30">{formatNumber(track.plays_count)}</span>
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header: na aba de faixas o título "Início" some pra dar mais
          espaço/destaque à vitrine de mais tocadas logo abaixo. Nas
          outras abas o cabeçalho continua normal. */}
      {activeTab !== 'tracks' && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold gradient-text">
              {activeTab === 'favorites' ? 'Favoritos' : 'Explorar'}
            </h1>
            <p className="text-black/40 text-sm mt-0.5">
              {activeTab === 'favorites'
                ? `${favoriteTracks.length} música${favoriteTracks.length !== 1 ? 's' : ''} salva${favoriteTracks.length !== 1 ? 's' : ''}`
                : 'Descubra novos artistas'}
            </p>
          </div>
          {player.isPlaying && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5">
              <Equalizer barCount={3} height={16} barWidth={2} gap={1} />
              <span className="text-xs text-black/60">Tocando</span>
            </div>
          )}
        </div>
      )}

      {/* Search: mais discreta/compacta pra não competir com a vitrine de
          mais tocadas. */}
      <div className={cn('relative', activeTab === 'tracks' ? 'mt-1 mb-2.5' : 'mb-3')}>
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/25" />
        <input
          type="text"
          placeholder="Buscar músicas, artistas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!pl-8 !py-1.5 !text-xs"
        />
      </div>

      {/* Tabs: também reduzidas, só pra navegação, sem chamar atenção. */}
      <div className="flex gap-1 mb-3">
        {(['tracks', 'favorites', 'artists'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 no-select',
              activeTab === tab
                ? 'gradient-bg text-white shadow-md'
                : 'bg-black/5 text-black/40 hover:bg-black/10 hover:text-black/60'
            )}
          >
            {tab === 'tracks' ? '🎵 Faixas' : tab === 'favorites' ? '⭐ Favoritos' : '🎤 Artistas'}
          </button>
        ))}
      </div>

      {/* Mais tocadas: vitrine em destaque no topo da tela inicial, em
          formato bento (cartões de tamanhos variados) pra dar bem mais
          peso visual do que uma lista horizontal comum. Só na aba de
          faixas e fora de uma busca (é destaque, não resultado filtrado). */}
      {activeTab === 'tracks' && !search && topTracks.length > 0 && (
        <div
          className="mb-6 -mx-4 px-4 py-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(232,67,147,0.15), rgba(108,92,231,0.1) 60%, transparent)' }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-5 h-5 rounded-md gradient-bg flex items-center justify-center flex-shrink-0">
              <TrendingUp size={11} className="text-white" />
            </div>
            <h2 className="text-xs font-bold text-[#1A1B25] uppercase tracking-wide">Mais tocadas</h2>
          </div>
          {renderMostPlayedBento()}
        </div>
      )}

      {/* Artistas mais populares: mesma moldura em destaque (fundo colorido
          de ponta a ponta) da vitrine "Mais tocadas" logo acima, pra ter o
          mesmo peso visual em vez de parecer uma lista secundária — 1º
          colocado em destaque e os demais num grid de cartões-foto. */}
      {activeTab === 'tracks' && !search && topArtists.length > 0 && (
        <div
          className="mb-6 -mx-4 px-4 py-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(253,203,110,0.20), rgba(232,67,147,0.1) 55%, transparent)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #FDCB6E, #FF8C42)' }}
              >
                <Flame size={11} className="text-white" fill="white" />
              </div>
              <h2 className="text-xs font-bold text-[#1A1B25] uppercase tracking-wide">Artistas mais populares</h2>
            </div>
            <span className="text-[10px] text-black/30 font-medium">por reproduções</span>
          </div>

          <div className="-mx-4">{renderTopArtistHero(topArtists[0])}</div>

          {topArtists.length > 1 && (
            <div className="grid grid-cols-2 gap-3">
              {topArtists.slice(1, 5).map((artist, i) => renderArtistRankCard(artist, i + 2))}
            </div>
          )}
        </div>
      )}

      {/* Tracks Grid */}
      {activeTab === 'tracks' && (
        <>
          {!search && (
            <h2 className="text-xs font-bold text-black/60 uppercase tracking-wide mb-3">Em alta</h2>
          )}
          <div className="grid grid-cols-2 gap-3">
            {filteredTracks.map((track) => renderTrackCard(track, filteredTracks))}
          </div>
        </>
      )}

      {/* Favorites Grid */}
      {activeTab === 'favorites' && (
        <div className="grid grid-cols-2 gap-3">
          {filteredFavoriteTracks.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <Star size={28} className="text-black/20" />
              </div>
              <p className="text-black/40 text-sm font-medium">Nenhuma música favoritada</p>
              <p className="text-black/25 text-xs mt-1">Toque na estrela para salvar suas músicas favoritas</p>
            </div>
          )}
          {filteredFavoriteTracks.map((track) => renderTrackCard(track, filteredFavoriteTracks))}
        </div>
      )}

      {/* Artists Grid */}
      {activeTab === 'artists' && (
        <div className="space-y-3">
          {filteredArtists.map((artist) => (
            <button
              key={artist.id}
              onClick={() => selectArtist(artist.id)}
              className="w-full flex items-center gap-4 p-3 rounded-2xl bg-white hover:bg-[#F2F2F8] shadow-sm transition-colors text-left"
            >
              <CoverArt
                title={artist.name}
                artistName={artist.genre}
                coverUrl={artist.avatar_url || artist.cover_url}
                size="sm"
                className="!w-14 !h-14 !max-w-none !rounded-xl flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1A1B25] truncate">{artist.name}</p>
                <p className="text-sm text-black/40">{artist.genre}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-black/50">{formatNumber(artist.followers_count)}</p>
                <p className="text-[10px] text-black/30">seguidores</p>
              </div>
              <div
                className="p-2 rounded-full bg-black/5"
                aria-label="Ver perfil do artista"
              >
                <Music2 size={16} className="text-black/50" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Bottom spacing for nav + mini player */}
      <div className="h-32" />
    </div>
  );
};

export default MainScreen;
