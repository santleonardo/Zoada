'use client';

import React, { useEffect, useState } from 'react';
import { Users, Loader2, Check, X, Trash2, Mic2 } from 'lucide-react';
import { listMyArtists, deleteArtistProfile } from '@/lib/trackUpload';
import type { ArtistProfile } from '@/lib/trackUpload';

interface MyArtistsPanelProps {
  /** Muda toda vez que um artista é criado/editado em outro painel, pra
   * essa lista se atualizar sozinha. */
  refreshKey?: number;
  /** Chamado depois que um artista é apagado com sucesso, pra quem estiver
   * de fora (lista de músicas, seletor de envio) também se atualizar —
   * apagar um artista apaga todas as músicas dele junto. */
  onArtistDeleted?: () => void;
}

/**
 * Seção separada de "Seus Artistas": lista todos os artistas dessa conta,
 * com a opção de apagar cada um (e, junto, todas as músicas dele). Fica
 * isolada do painel de envio/edição (UploadMusicPanel) para não misturar
 * "editar/enviar" com "apagar" — uma ação destrutiva e permanente merece
 * seu próprio espaço, bem sinalizado, para não ser clicada por engano.
 */
const MyArtistsPanel: React.FC<MyArtistsPanelProps> = ({ refreshKey, onArtistDeleted }) => {
  const [artists, setArtists] = useState<ArtistProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchArtists = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listMyArtists();
      setArtists(list);
    } catch (err) {
      // "Não logado" é um estado vazio legítimo (ninguém tem artistas
      // antes de entrar numa conta real) — não é um erro pra mostrar na
      // tela. Qualquer OUTRA falha (rede, 500, etc.) é tratada como erro
      // de verdade abaixo, pra não ficar indistinguível de "você
      // simplesmente não tem artistas ainda".
      if (err instanceof Error && err.message.includes('logado')) {
        setArtists([]);
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao carregar seus artistas');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleDelete = async (artistId: string) => {
    setDeletingId(artistId);
    setError(null);
    try {
      await deleteArtistProfile(artistId);
      setArtists((prev) => prev.filter((a) => a.id !== artistId));
      onArtistDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao apagar artista');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="rounded-2xl bg-[#1E2030] p-5 mb-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[#E84393]" />
          <h3 className="text-lg font-semibold text-white">Seus Artistas</h3>
        </div>
        {!loading && <span className="text-sm text-white/40">{artists.length} artista{artists.length === 1 ? '' : 's'}</span>}
      </div>
      <p className="text-white/40 text-sm mb-4">
        Apagar um artista apaga também todas as músicas publicadas por ele. Essa ação não pode ser desfeita.
      </p>

      {/* Erros de ação (ex: falha ao apagar) — só faz sentido junto com uma
          lista que já carregou. Erros de carregamento têm seu próprio
          bloco abaixo, pra não ficar parecendo "lista vazia normal". */}
      {error && artists.length > 0 && <p className="text-xs text-[#E84393] mb-3">{error}</p>}

      {loading ? (
        <p className="text-xs text-white/40">Carregando...</p>
      ) : artists.length === 0 && error ? (
        <div className="rounded-xl bg-[#E84393]/10 p-6 text-center">
          <Mic2 size={32} className="text-[#E84393]/40 mx-auto mb-2" />
          <p className="text-[#E84393] text-sm mb-3">{error}</p>
          <button
            onClick={fetchArtists}
            className="text-xs text-white underline underline-offset-2 hover:text-white/80"
          >
            Tentar novamente
          </button>
        </div>
      ) : artists.length === 0 ? (
        <div className="rounded-xl bg-white/5 p-6 text-center">
          <Mic2 size={32} className="text-white/10 mx-auto mb-2" />
          <p className="text-white/40 text-sm">Você ainda não criou nenhum artista</p>
        </div>
      ) : (
        <div className="space-y-2">
          {artists.map((artist) => (
            <div key={artist.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
              <div className="w-10 h-10 rounded-full bg-[#252840] overflow-hidden flex-shrink-0 flex items-center justify-center">
                {artist.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={artist.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Mic2 size={14} className="text-white/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{artist.name}</p>
                <p className="text-xs text-white/40 truncate">{artist.genre || 'Sem gênero definido'}</p>
              </div>

              {confirmDeleteId === artist.id ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {deletingId === artist.id ? (
                    <Loader2 size={16} className="text-[#FF8C42] animate-spin" />
                  ) : (
                    <>
                      <span className="text-[11px] text-white/40 mr-1">Apagar artista e músicas?</span>
                      <button
                        onClick={() => handleDelete(artist.id)}
                        aria-label={`Confirmar exclusão de "${artist.name}"`}
                        className="p-1 rounded-full bg-[#E84393]/20 text-[#E84393] hover:bg-[#E84393]/30"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        aria-label="Cancelar"
                        className="p-1 rounded-full bg-white/5 text-white/50 hover:bg-white/10"
                      >
                        <X size={14} />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(artist.id)}
                  aria-label={`Apagar artista "${artist.name}"`}
                  className="p-1.5 rounded-full text-white/30 hover:text-[#E84393] hover:bg-[#E84393]/10 flex-shrink-0"
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

export default MyArtistsPanel;
