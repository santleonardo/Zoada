'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Radio, Loader2, Check, X, Trash2, ChevronDown, Plus, GripVertical, ImagePlus, RadioTower, VolumeX } from 'lucide-react';
import { fetchMyRadioStation, saveRadioStation, activateRadioStation, deactivateRadioStation, deleteRadioStation, fetchAllTracks } from '@/lib/api';
import { uploadImageFile } from '@/lib/trackUpload';
import type { RadioStation, Track } from '@/types';
import CoverArt from './CoverArt';
import GradientButton from './GradientButton';

interface MyRadioStationPanelProps {
  /** Muda toda vez que algo externo precisar que esta lista se atualize. */
  refreshKey?: number;
}

/**
 * Painel de criação/gestão da estação de rádio do usuário. Segue o mesmo
 * padrão visual/estrutural de MyArtistsPanel (accordion fechado por padrão,
 * loading state, tratamento de erro). Cada usuário pode ter UMA estação —
 * se já existir, o painel mostra as opções de editar/ativar/desativar/apagar;
 * se não existir, mostra o formulário de criação.
 */
const MyRadioStationPanel: React.FC<MyRadioStationPanelProps> = ({ refreshKey }) => {
  // Seção fechada por padrão; usuário abre clicando no cabeçalho.
  const [isOpen, setIsOpen] = useState(false);
  const [station, setStation] = useState<RadioStation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado do formulário de criação/edição
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Catálogo completo de faixas (pra montar o seletor)
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // Confirmação de exclusão
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Confirmação de ativar/desativar
  const [togglingActive, setTogglingActive] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);

  // Busca a estação do usuário e o catálogo de faixas
  const fetchStation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchMyRadioStation();
      setStation(s);
      if (s) {
        setName(s.name);
        setCoverPreview(s.cover_url);
        setSelectedTrackIds(s.tracks?.map((t) => t.id) || []);
      } else {
        // Reset formulário quando não há estação
        setName('');
        setCoverPreview(null);
        setSelectedTrackIds([]);
      }
    } catch (err) {
      // Modo demo (sem conta real) — não mostra erro na tela.
      if (err instanceof Error && err.message.includes('logado')) {
        setStation(null);
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao carregar sua estação');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    setLoadingTracks(true);
    try {
      const tracks = await fetchAllTracks();
      setAllTracks(tracks);
    } catch {
      // Falha silenciosa — o seletor de faixas fica vazio.
    } finally {
      setLoadingTracks(false);
    }
  }, []);

  useEffect(() => {
    fetchStation();
    fetchCatalog();
  }, [fetchStation, fetchCatalog, refreshKey]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const toggleTrack = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      if (prev.includes(trackId)) {
        return prev.filter((id) => id !== trackId);
      }
      return [...prev, trackId];
    });
  };

  // Move uma faixa selecionada para cima/baixo na ordem
  const moveTrack = (index: number, direction: -1 | 1) => {
    const newOrder = [...selectedTrackIds];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    [newOrder[index], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[index]];
    setSelectedTrackIds(newOrder);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('O nome da estação não pode ficar vazio');
      return;
    }
    if (selectedTrackIds.length === 0) {
      setError('Selecione pelo menos uma faixa');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Sobe a capa nova pro R2, se o usuário escolheu uma
      const coverUrl = coverFile ? await uploadImageFile(coverFile, 'covers') : undefined;

      const saved = await saveRadioStation({
        name: trimmedName,
        cover_url: coverUrl ?? station?.cover_url ?? null,
        track_ids: selectedTrackIds,
      });

      if (saved) {
        setStation(saved);
        setCoverFile(null);
        setIsEditing(false);
      } else {
        setError('Falha ao salvar a estação. Tente novamente.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar a estação');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    setTogglingActive(true);
    setError(null);
    try {
      const updated = await activateRadioStation();
      if (updated) {
        setStation(updated);
      } else {
        setError('Falha ao ativar a estação. Tente novamente.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ativar a estação');
    } finally {
      setTogglingActive(false);
    }
  };

  const handleDeactivate = async () => {
    setTogglingActive(true);
    setError(null);
    try {
      const updated = await deactivateRadioStation();
      if (updated) {
        setStation(updated);
      } else {
        setError('Falha ao desativar a estação. Tente novamente.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar a estação');
    } finally {
      setTogglingActive(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const ok = await deleteRadioStation();
      if (ok) {
        setStation(null);
        setName('');
        setCoverPreview(null);
        setSelectedTrackIds([]);
        setIsEditing(false);
      } else {
        setError('Falha ao apagar a estação');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao apagar a estação');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // Lookup rápido de track por ID pra renderizar a lista selecionada
  const trackMap = new Map(allTracks.map((t) => [t.id, t]));

  return (
    <div className="rounded-2xl bg-white shadow-sm p-5 mb-6">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex items-center justify-between w-full mb-1"
      >
        <div className="flex items-center gap-2">
          <Radio size={18} className="text-[#FF8C42]" />
          <h3 className="text-lg font-semibold text-[#1A1B25]">Minha Estação de Rádio</h3>
        </div>
        <div className="flex items-center gap-2">
          {station?.is_active && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              Ao vivo
            </span>
          )}
          {!loading && station && (
            <span className="text-sm text-black/40">
              {station.tracks?.length || 0} faixa{(station.tracks?.length || 0) === 1 ? '' : 's'}
            </span>
          )}
          <ChevronDown
            size={18}
            className={`text-black/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <>
          {/* Se já existe estação e NÃO está editando: mostra o resumo + ações */}
          {station && !isEditing && (
            <>
              <div className="flex items-center gap-3 mt-4 mb-4 p-3 rounded-xl bg-[#F7F7FB]">
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-[#EFF0F6]">
                  {station.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={station.cover_url} alt={station.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Radio size={20} className="text-black/20" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1A1B25] truncate">{station.name}</p>
                  <p className="text-xs text-black/40">
                    {station.is_active ? 'Estação ativa — tocando para todo mundo' : 'Estação criada — não está no ar'}
                  </p>
                </div>
              </div>

              {/* Ações da estação */}
              <div className="space-y-2">
                {/* Ativar / Desativar */}
                {station.is_active ? (
                  <button
                    onClick={handleDeactivate}
                    disabled={togglingActive}
                    className="flex items-center gap-3 w-full p-3 rounded-xl bg-red-50 hover:bg-red-100 transition-colors text-left disabled:opacity-50"
                  >
                    {togglingActive ? (
                      <Loader2 size={18} className="text-red-500 animate-spin" />
                    ) : (
                      <VolumeX size={18} className="text-red-500" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-700">Tirar do ar</p>
                      <p className="text-[11px] text-red-500">O rádio volta ao shuffle padrão</p>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={handleActivate}
                    disabled={togglingActive || (station.tracks?.length || 0) === 0}
                    className="flex items-center gap-3 w-full p-3 rounded-xl bg-green-50 hover:bg-green-100 transition-colors text-left disabled:opacity-50"
                  >
                    {togglingActive ? (
                      <Loader2 size={18} className="text-green-600 animate-spin" />
                    ) : (
                      <RadioTower size={18} className="text-green-600" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-700">Colocar no ar</p>
                      <p className="text-[11px] text-green-600">Sua estação toca para todo mundo</p>
                    </div>
                  </button>
                )}

                {/* Editar */}
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#F7F7FB] hover:bg-[#EFF0F6] transition-colors text-left"
                >
                  <Plus size={18} className="text-[#FF8C42]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1A1B25]">Editar estação</p>
                    <p className="text-[11px] text-black/40">Alterar nome, capa ou lista de faixas</p>
                  </div>
                </button>

                {/* Apagar */}
                {confirmDelete ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50">
                    {deleting ? (
                      <Loader2 size={16} className="text-red-500 animate-spin flex-shrink-0" />
                    ) : (
                      <>
                        <span className="text-[11px] text-red-600 flex-1">Apagar esta estação permanentemente?</span>
                        <button
                          onClick={handleDelete}
                          className="p-1 rounded-full bg-red-500/20 text-red-600 hover:bg-red-500/30"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="p-1 rounded-full bg-black/5 text-black/50 hover:bg-black/10"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#F7F7FB] hover:bg-red-50 transition-colors text-left"
                  >
                    <Trash2 size={18} className="text-black/30" />
                    <p className="text-sm text-black/50">Apagar estação</p>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Se NÃO existe estação OU está editando: mostra o formulário */}
          {(!station || isEditing) && (
            <div className="mt-4 space-y-4">
              <p className="text-black/40 text-sm">
                {!station
                  ? 'Crie sua estação de rádio personalizada. Escolha um nome, uma capa opcional e selecione as faixas na ordem desejada.'
                  : 'Edite o nome, a capa ou a lista de faixas da sua estação.'}
              </p>

              {error && <p className="text-xs text-red-500">{error}</p>}

              {/* Nome */}
              <div>
                <label className="text-xs font-medium text-black/60 block mb-1">Nome da estação</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Sessão Acústica, Set de DJ..."
                  className="!text-sm"
                />
              </div>

              {/* Capa opcional */}
              <div>
                <label className="text-xs font-medium text-black/60 block mb-1">Capa (opcional)</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#EFF0F6] border border-black/5">
                    {coverPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="w-full h-full flex items-center justify-center hover:bg-black/5 transition-colors"
                      >
                        <ImagePlus size={20} className="text-black/20" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="text-xs text-[#FF8C42] hover:text-[#FFB074] transition-colors text-left"
                    >
                      {coverPreview ? 'Trocar capa' : 'Escolher capa'}
                    </button>
                    {coverPreview && (
                      <button
                        type="button"
                        onClick={() => { setCoverPreview(null); setCoverFile(null); }}
                        className="text-xs text-black/40 hover:text-black/60 transition-colors text-left"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverChange}
                  />
                </div>
              </div>

              {/* Lista de faixas selecionadas (ordenável) */}
              <div>
                <label className="text-xs font-medium text-black/60 block mb-1">
                  Faixas selecionadas ({selectedTrackIds.length})
                </label>
                {selectedTrackIds.length === 0 ? (
                  <div className="rounded-xl bg-black/[0.03] p-4 text-center">
                    <p className="text-black/40 text-sm">Nenhuma faixa selecionada</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {selectedTrackIds.map((trackId, index) => {
                      const track = trackMap.get(trackId);
                      if (!track) return null;
                      return (
                        <div
                          key={trackId}
                          className="flex items-center gap-2 p-2 rounded-lg bg-[#F7F7FB] group"
                        >
                          <GripVertical size={14} className="text-black/15 flex-shrink-0" />
                          <span className="text-[10px] text-black/25 w-4 text-center flex-shrink-0">{index + 1}</span>
                          <CoverArt
                            title={track.title}
                            artistName={track.artist_name}
                            coverUrl={track.cover_url}
                            size="sm"
                            className="!w-8 !h-8 !max-w-none !rounded-md flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#1A1B25] truncate">{track.title}</p>
                            <p className="text-[10px] text-black/40 truncate">{track.artist_name}</p>
                          </div>
                          {/* Botões de mover/remover */}
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => moveTrack(index, -1)}
                              disabled={index === 0}
                              className="p-0.5 rounded text-black/20 hover:text-black/50 disabled:opacity-30"
                              aria-label="Mover para cima"
                            >
                              <ChevronDown size={12} className="rotate-180" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveTrack(index, 1)}
                              disabled={index === selectedTrackIds.length - 1}
                              className="p-0.5 rounded text-black/20 hover:text-black/50 disabled:opacity-30"
                              aria-label="Mover para baixo"
                            >
                              <ChevronDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleTrack(trackId)}
                              className="p-0.5 rounded text-black/20 hover:text-red-500 ml-1"
                              aria-label={`Remover "${track.title}"`}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Catálogo de faixas (seletor) */}
              <div>
                <label className="text-xs font-medium text-black/60 block mb-1">Adicionar faixas do catálogo</label>
                {loadingTracks ? (
                  <p className="text-xs text-black/40">Carregando catálogo...</p>
                ) : allTracks.length === 0 ? (
                  <p className="text-xs text-black/40">Nenhuma faixa disponível no catálogo</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {allTracks
                      .filter((t) => !selectedTrackIds.includes(t.id))
                      .map((track) => (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => toggleTrack(track.id)}
                          className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-[#F7F7FB] transition-colors text-left"
                        >
                          <Plus size={12} className="text-[#FF8C42] flex-shrink-0" />
                          <CoverArt
                            title={track.title}
                            artistName={track.artist_name}
                            coverUrl={track.cover_url}
                            size="sm"
                            className="!w-7 !h-7 !max-w-none !rounded-md flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#1A1B25] truncate">{track.title}</p>
                            <p className="text-[10px] text-black/40 truncate">{track.artist_name}</p>
                          </div>
                        </button>
                      ))}
                    {allTracks.filter((t) => !selectedTrackIds.includes(t.id)).length === 0 && (
                      <p className="text-xs text-black/40 text-center py-2">Todas as faixas já foram selecionadas</p>
                    )}
                  </div>
                )}
              </div>

              {/* Botões de salvar / cancelar */}
              <div className="flex items-center gap-2 justify-end">
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setError(null);
                      // Restaura os dados originais da estação
                      if (station) {
                        setName(station.name);
                        setCoverPreview(station.cover_url);
                        setSelectedTrackIds(station.tracks?.map((t) => t.id) || []);
                      }
                    }}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-black/5 hover:bg-black/10 text-sm text-black/60 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                )}
                <GradientButton onClick={handleSave} loading={saving} size="sm">
                  {station ? 'Salvar alterações' : 'Criar estação'}
                </GradientButton>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && !isEditing && (
            <p className="text-xs text-black/40 mt-2">Carregando...</p>
          )}
        </>
      )}
    </div>
  );
};

export default MyRadioStationPanel;
