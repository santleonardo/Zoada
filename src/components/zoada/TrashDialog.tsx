'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, Trash2, RotateCcw, Music2, Mic2, MessageSquare, Radio } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchTrash,
  restoreTrack,
  restoreArtist,
  restorePost,
  restorePostComment,
  restoreRadioStation,
  type TrashContents,
} from '@/lib/api';

interface TrashDialogProps {
  open: boolean;
  onClose: () => void;
  // Avisa o resto da tela (faixas, artistas, posts, estação) que algo foi
  // restaurado, pra recarregar as listas correspondentes.
  onRestored?: () => void;
}

// Painel "Lixeira": tudo que o usuário apagou (faixa, artista, postagem,
// comentário, estação de rádio) e ainda está dentro dos 30 dias pra
// restaurar. Cada item mostra quantos dias faltam antes de sumir de vez.
const TrashDialog: React.FC<TrashDialogProps> = ({ open, onClose, onRestored }) => {
  const [data, setData] = useState<TrashContents | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchTrash()
      .then(setData)
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const isEmpty =
    data &&
    data.tracks.length === 0 &&
    data.artists.length === 0 &&
    data.posts.length === 0 &&
    data.comments.length === 0 &&
    !data.station;

  const daysLabel = (days: number) => (days <= 0 ? 'último dia' : `${days} dia${days === 1 ? '' : 's'}`);

  const handleRestore = async (key: string, action: () => Promise<boolean>, label: string) => {
    setRestoringId(key);
    const ok = await action();
    setRestoringId(null);
    if (ok) {
      toast.success(`${label} restaurado(a)!`);
      const fresh = await fetchTrash();
      setData(fresh);
      onRestored?.();
    } else {
      toast.error(`Não foi possível restaurar. Tente de novo.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-[#F7F7FB] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-black/5 sticky top-0 bg-[#F7F7FB] z-10">
          <h2 className="text-lg font-bold text-[#1A1B25] flex items-center gap-2">
            <Trash2 size={18} className="text-black/40" />
            Lixeira
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <X size={16} className="text-black/50" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-xs text-black/45 leading-relaxed -mt-1">
            O que você apagou fica aqui por até 30 dias antes de sumir de vez.
            Restaure a qualquer momento dentro desse prazo.
          </p>

          {loading && (
            <div className="flex items-center justify-center py-10 text-black/30">
              <Loader2 size={22} className="animate-spin" />
            </div>
          )}

          {!loading && isEmpty && (
            <p className="text-sm text-black/40 text-center py-10">Sua lixeira está vazia.</p>
          )}

          {!loading && data && data.tracks.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-black/40 uppercase tracking-wide flex items-center gap-1.5">
                <Music2 size={13} /> Faixas
              </h3>
              {data.tracks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1B25] truncate">{t.title}</p>
                    <p className="text-xs text-black/40 truncate">
                      {t.artist_name} · restaura por mais {daysLabel(t.days_left)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(t.id, () => restoreTrack(t.id), 'Faixa')}
                    disabled={restoringId === t.id}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-xs font-semibold text-[#1A1B25] transition-colors disabled:opacity-50"
                  >
                    {restoringId === t.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    Restaurar
                  </button>
                </div>
              ))}
            </section>
          )}

          {!loading && data && data.artists.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-black/40 uppercase tracking-wide flex items-center gap-1.5">
                <Mic2 size={13} /> Artistas
              </h3>
              {data.artists.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1B25] truncate">{a.name}</p>
                    <p className="text-xs text-black/40">restaura por mais {daysLabel(a.days_left)}</p>
                  </div>
                  <button
                    onClick={() => handleRestore(a.id, () => restoreArtist(a.id), 'Artista')}
                    disabled={restoringId === a.id}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-xs font-semibold text-[#1A1B25] transition-colors disabled:opacity-50"
                  >
                    {restoringId === a.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    Restaurar
                  </button>
                </div>
              ))}
            </section>
          )}

          {!loading && data && data.posts.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-black/40 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare size={13} /> Postagens
              </h3>
              {data.posts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1B25] truncate">
                      {p.track_title || p.content || 'Postagem'}
                    </p>
                    <p className="text-xs text-black/40">restaura por mais {daysLabel(p.days_left)}</p>
                  </div>
                  <button
                    onClick={() => handleRestore(p.id, () => restorePost(p.id), 'Postagem')}
                    disabled={restoringId === p.id}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-xs font-semibold text-[#1A1B25] transition-colors disabled:opacity-50"
                  >
                    {restoringId === p.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    Restaurar
                  </button>
                </div>
              ))}
            </section>
          )}

          {!loading && data && data.comments.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-black/40 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare size={13} /> Comentários
              </h3>
              {data.comments.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1A1B25] truncate">{c.content}</p>
                    <p className="text-xs text-black/40">restaura por mais {daysLabel(c.days_left)}</p>
                  </div>
                  <button
                    onClick={() => handleRestore(c.id, () => restorePostComment(c.id), 'Comentário')}
                    disabled={restoringId === c.id}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-xs font-semibold text-[#1A1B25] transition-colors disabled:opacity-50"
                  >
                    {restoringId === c.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    Restaurar
                  </button>
                </div>
              ))}
            </section>
          )}

          {!loading && data?.station && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-black/40 uppercase tracking-wide flex items-center gap-1.5">
                <Radio size={13} /> Estação de rádio
              </h3>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1B25] truncate">{data.station.name}</p>
                  <p className="text-xs text-black/40">restaura por mais {daysLabel(data.station.days_left)}</p>
                </div>
                <button
                  onClick={() => handleRestore(data.station!.id, restoreRadioStation, 'Estação')}
                  disabled={restoringId === data.station.id}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-xs font-semibold text-[#1A1B25] transition-colors disabled:opacity-50"
                >
                  {restoringId === data.station.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <RotateCcw size={13} />
                  )}
                  Restaurar
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrashDialog;
