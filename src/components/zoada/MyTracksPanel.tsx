'use client';

import React, { useEffect, useState } from 'react';
import { Music2, Loader2, Check, X, Trash2, ListMusic } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { deleteTrackFile } from '@/lib/trackUpload';
import type { Track } from '@/types';

interface MyTracksPanelProps {
  /** Muda toda vez que um novo envio termina, pra essa lista se atualizar sozinha. */
  refreshKey?: number;
}

/**
 * Seção separada de "Suas músicas enviadas": lista tudo que já foi
 * publicado por QUALQUER artista dessa conta (uma conta pode ter mais de
 * um artista), com opção de apagar. Fica independente do painel de envio
 * (UploadMusicPanel), que cuida apenas de subir músicas novas.
 */
const MyTracksPanel: React.FC<MyTracksPanelProps> = ({ refreshKey }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTracks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/tracks?mine=1');
      if (!res.ok) {
        if (res.status === 401) {
          setTracks([]);
          return;
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao carregar suas músicas');
      }
      const data = await res.json();
      if (Array.isArray(data.tracks)) setTracks(data.tracks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar suas músicas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleDelete = async (trackId: string) => {
    setDeletingId(trackId);
    setError(null);
    try {
      await deleteTrackFile(trackId);
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao apagar faixa');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="rounded-2xl bg-card p-5 mb-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ListMusic size={18} className="text-[#00CEC9]" />
          <h3 className="text-lg font-semibold text-foreground">Suas Músicas Enviadas</h3>
        </div>
        {!loading && <span className="text-sm text-foreground/40">{tracks.length} faixas</span>}
      </div>
      <p className="text-foreground/40 text-sm mb-4">
        Tudo que você já publicou, em todos os artistas da sua conta.
      </p>

      {error && <p className="text-xs text-[#E84393] mb-3">{error}</p>}

      {loading ? (
        <p className="text-xs text-foreground/40">Carregando...</p>
      ) : tracks.length === 0 ? (
        <div className="rounded-xl bg-foreground/5 p-6 text-center">
          <Music2 size={32} className="text-foreground/15 mx-auto mb-2" />
          <p className="text-foreground/40 text-sm">Você ainda não enviou nenhuma música</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tracks.map((track) => (
            <div key={track.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-foreground/5">
              <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0 flex items-center justify-center">
                {track.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={track.cover_url} alt="Capa" className="w-full h-full object-cover" />
                ) : (
                  <Music2 size={14} className="text-foreground/35" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{track.title}</p>
                <p className="text-xs text-foreground/40 truncate">{track.artist_name}</p>
              </div>

              {confirmDeleteId === track.id ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {deletingId === track.id ? (
                    <Loader2 size={16} className="text-[#FF8C42] animate-spin" />
                  ) : (
                    <>
                      <span className="text-[11px] text-foreground/40 mr-1">Apagar?</span>
                      <button
                        onClick={() => handleDelete(track.id)}
                        aria-label="Confirmar exclusão"
                        className="p-1 rounded-full bg-[#E84393]/20 text-[#E84393] hover:bg-[#E84393]/30"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        aria-label="Cancelar"
                        className="p-1 rounded-full bg-foreground/5 text-foreground/50 hover:bg-foreground/10"
                      >
                        <X size={14} />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(track.id)}
                  aria-label={`Apagar "${track.title}"`}
                  className="p-1.5 rounded-full text-foreground/35 hover:text-[#E84393] hover:bg-[#E84393]/10 flex-shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyTracksPanel;
