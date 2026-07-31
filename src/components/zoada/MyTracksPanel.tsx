'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Music2, Loader2, Check, X, Trash2, ListMusic, Pencil, ImagePlus, ChevronDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { deleteTrackFile, updateTrackInfo, uploadImageFile } from '@/lib/trackUpload';
import { useAppStore } from '@/store/useAppStore';
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
  const selectArtist = useAppStore((state) => state.selectArtist);
  // Seção fechada por padrão; usuário abre clicando no cabeçalho.
  const [isOpen, setIsOpen] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edição inline: qual faixa está em modo de edição agora, e os campos
  // temporários dela (título/capa) até salvar ou cancelar.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const editCoverInputRef = useRef<HTMLInputElement>(null);

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

  const startEdit = (track: Track) => {
    setConfirmDeleteId(null);
    setEditingId(track.id);
    setEditTitle(track.title);
    setEditCoverFile(null);
    setEditCoverPreview(track.cover_url || null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCoverFile(null);
    setEditCoverPreview(null);
  };

  const handlePickEditCover = (file: File | null) => {
    if (!file) return;
    setEditCoverFile(file);
    setEditCoverPreview(URL.createObjectURL(file));
  };

  const saveEdit = async (trackId: string) => {
    if (!editTitle.trim()) {
      setError('O título não pode ficar em branco.');
      return;
    }
    setSavingId(trackId);
    setError(null);
    try {
      const coverUrl = editCoverFile ? await uploadImageFile(editCoverFile, 'track-covers') : undefined;
      await updateTrackInfo(trackId, {
        titulo: editTitle.trim(),
        ...(coverUrl ? { coverUrl } : {}),
      });
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? { ...t, title: editTitle.trim(), cover_url: coverUrl || t.cover_url }
            : t
        )
      );
      setEditingId(null);
      setEditCoverFile(null);
      setEditCoverPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar alterações');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="rounded-2xl bg-white shadow-sm p-5 mb-6">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex items-center justify-between w-full mb-1"
      >
        <div className="flex items-center gap-2">
          <ListMusic size={18} className="text-[#00CEC9]" />
          <h3 className="text-lg font-semibold text-[#1A1B25]">Suas Músicas Enviadas</h3>
        </div>
        <div className="flex items-center gap-2">
          {!loading && <span className="text-sm text-black/40">{tracks.length} faixas</span>}
          <ChevronDown
            size={18}
            className={`text-black/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <>
          <p className="text-black/40 text-sm mb-4">
            Tudo que você já publicou, em todos os artistas da sua conta. Toque no lápis pra editar título/capa.
          </p>

          {error && <p className="text-xs text-[#E84393] mb-3">{error}</p>}

          <input
            ref={editCoverInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handlePickEditCover(e.target.files?.[0] || null)}
          />

          {loading ? (
        <p className="text-xs text-black/40">Carregando...</p>
      ) : tracks.length === 0 ? (
        <div className="rounded-xl bg-black/[0.03] p-6 text-center">
          <Music2 size={32} className="text-black/15 mx-auto mb-2" />
          <p className="text-black/40 text-sm">Você ainda não enviou nenhuma música</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tracks.map((track) => {
            const isEditing = editingId === track.id;
            const isSaving = savingId === track.id;

            if (isEditing) {
              return (
                <div key={track.id} className="px-3 py-3 rounded-xl bg-[#F7F7FB] space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => editCoverInputRef.current?.click()}
                      className="w-10 h-10 rounded-lg bg-[#EFF0F6] overflow-hidden flex-shrink-0 flex items-center justify-center"
                      aria-label="Trocar capa da faixa"
                      disabled={isSaving}
                    >
                      {editCoverPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={editCoverPreview} alt="Capa" className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlus size={14} className="text-black/30" />
                      )}
                    </button>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      disabled={isSaving}
                      className="flex-1 min-w-0 !py-1.5 !text-sm"
                      placeholder="Título da música"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    {isSaving ? (
                      <Loader2 size={16} className="text-[#FF8C42] animate-spin" />
                    ) : (
                      <>
                        <button
                          onClick={() => saveEdit(track.id)}
                          aria-label="Salvar alterações"
                          className="p-1.5 rounded-full bg-[#00CEC9]/20 text-[#00CEC9] hover:bg-[#00CEC9]/30"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          aria-label="Cancelar edição"
                          className="p-1.5 rounded-full bg-black/5 text-black/50 hover:bg-black/10"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={track.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#F7F7FB]">
                <div className="w-10 h-10 rounded-lg bg-[#EFF0F6] overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {track.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.cover_url} alt="Capa" className="w-full h-full object-cover" />
                  ) : (
                    <Music2 size={14} className="text-black/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1A1B25] truncate">{track.title}</p>
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

                {confirmDeleteId === track.id ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {deletingId === track.id ? (
                      <Loader2 size={16} className="text-[#FF8C42] animate-spin" />
                    ) : (
                      <>
                        <span className="text-[11px] text-black/40 mr-1">Apagar?</span>
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
                          className="p-1 rounded-full bg-black/5 text-black/50 hover:bg-black/10"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(track)}
                      aria-label={`Editar "${track.title}"`}
                      className="p-1.5 rounded-full text-black/30 hover:text-[#FF8C42] hover:bg-[#FF8C42]/10"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(track.id)}
                      aria-label={`Apagar "${track.title}"`}
                      className="p-1.5 rounded-full text-black/30 hover:text-[#E84393] hover:bg-[#E84393]/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default MyTracksPanel;
