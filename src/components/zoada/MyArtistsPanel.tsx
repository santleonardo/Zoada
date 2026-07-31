'use client';

import React, { useEffect, useState } from 'react';
import { Users, Loader2, Check, X, Trash2, Mic2, Pencil, ChevronDown } from 'lucide-react';
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
  /** Chamado quando a pessoa quer editar este artista — quem estiver de
   * fora decide o que fazer (aqui: selecionar esse artista no painel de
   * envio, que é onde a edição de perfil de artista realmente acontece). */
  onEditArtist?: (artistId: string) => void;
}

/**
 * Seção separada de "Seus Artistas": lista todos os artistas dessa conta,
 * com a opção de apagar cada um (e, junto, todas as músicas dele). Fica
 * isolada do painel de envio/edição (UploadMusicPanel) para não misturar
 * "editar/enviar" com "apagar" — uma ação destrutiva e permanente merece
 * seu próprio espaço, bem sinalizado, para não ser clicada por engano.
 */
const MyArtistsPanel: React.FC<MyArtistsPanelProps> = ({ refreshKey, onArtistDeleted, onEditArtist }) => {
  // Seção fechada por padrão; usuário abre clicando no cabeçalho.
  const [isOpen, setIsOpen] = useState(false);
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
      // Modo demo (sem conta real) simplesmente não tem artistas próprios —
      // não é um erro que precise aparecer na tela.
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
    <div className="rounded-2xl bg-white shadow-sm p-5 mb-6">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex items-center justify-between w-full mb-1"
      >
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[#E84393]" />
          <h3 className="text-lg font-semibold text-[#1A1B25]">Seus Artistas</h3>
        </div>
        <div className="flex items-center gap-2">
          {!loading && <span className="text-sm text-black/40">{artists.length} artista{artists.length === 1 ? '' : 's'}</span>}
          <ChevronDown
            size={18}
            className={`text-black/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <>
          <p className="text-black/40 text-sm mb-4">
            Apagar um artista apaga também todas as músicas publicadas por ele. Essa ação não pode ser desfeita.
          </p>

          {error && <p className="text-xs text-[#E84393] mb-3">{error}</p>}

          {loading ? (
        <p className="text-xs text-black/40">Carregando...</p>
      ) : artists.length === 0 ? (
        <div className="rounded-xl bg-black/[0.03] p-6 text-center">
          <Mic2 size={32} className="text-black/15 mx-auto mb-2" />
          <p className="text-black/40 text-sm">Você ainda não criou nenhum artista</p>
        </div>
      ) : (
        <div className="space-y-2">
          {artists.map((artist) => (
            <div key={artist.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#F7F7FB]">
              <div className="w-10 h-10 rounded-full bg-[#EFF0F6] overflow-hidden flex-shrink-0 flex items-center justify-center">
                {artist.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={artist.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Mic2 size={14} className="text-black/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1A1B25] truncate">{artist.name}</p>
                <p className="text-xs text-black/40 truncate">{artist.genre || 'Sem gênero definido'}</p>
              </div>

              {confirmDeleteId === artist.id ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {deletingId === artist.id ? (
                    <Loader2 size={16} className="text-[#FF8C42] animate-spin" />
                  ) : (
                    <>
                      <span className="text-[11px] text-black/40 mr-1">Apagar artista e músicas?</span>
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
                        className="p-1 rounded-full bg-black/5 text-black/50 hover:bg-black/10"
                      >
                        <X size={14} />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {onEditArtist && (
                    <button
                      onClick={() => onEditArtist(artist.id)}
                      aria-label={`Editar artista "${artist.name}"`}
                      className="p-1.5 rounded-full text-black/30 hover:text-[#FF8C42] hover:bg-[#FF8C42]/10"
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDeleteId(artist.id)}
                    aria-label={`Apagar artista "${artist.name}"`}
                    className="p-1.5 rounded-full text-black/30 hover:text-[#E84393] hover:bg-[#E84393]/10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default MyArtistsPanel;
