'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, Music2, CheckCircle2, XCircle, Loader2, ImagePlus, X, ChevronDown, AlertTriangle } from 'lucide-react';
import {
  listMyArtists,
  createArtist,
  updateMyArtistProfile,
  uploadImageFile,
  uploadTrackFile,
  estimateBitrateKbps,
  type ArtistProfile,
} from '@/lib/trackUpload';
import GradientButton from './GradientButton';

// Bitrate mínimo recomendado. Abaixo disso, avisamos o artista antes do
// envio (não bloqueia — é só um alerta, já que às vezes é a única versão
// que a pessoa tem da música).
const MIN_RECOMMENDED_KBPS = 256;

interface TrackItem {
  file: File;
  title: string;
  coverFile: File | null;
  coverPreview: string | null;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  statusText?: string;
  // undefined = ainda checando; null = não deu pra estimar (ex: falha ao
  // ler metadados); number = bitrate estimado em kbps.
  bitrateKbps?: number | null;
}

interface UploadMusicPanelProps {
  userName: string;
  /** Chamado sempre que um envio termina (com sucesso ou erro), pra quem
   * estiver de fora (ex: a lista de "músicas enviadas") poder se atualizar. */
  onUploaded?: () => void;
  /** Muda toda vez que a lista de artistas precisa ser recarregada de fora
   * (ex: depois de apagar um artista no painel "Seus artistas"), pra esse
   * seletor não continuar mostrando um artista que já foi apagado. */
  refreshKey?: number;
  /** Id do artista que deve ser selecionado neste painel (ex: clicou em
   * "Editar" no painel "Seus Artistas"). Junto com focusToken, que muda a
   * cada clique — mesmo clicando duas vezes seguidas no mesmo artista, o
   * efeito precisa disparar de novo e rolar a tela até aqui. */
  focusArtistId?: string | null;
  focusToken?: number;
}

/** Valor especial usado no seletor pra representar "vou criar um artista novo". */
const NEW_ARTIST = '__new__';

const UploadMusicPanel: React.FC<UploadMusicPanelProps> = ({ userName, onUploaded, refreshKey, focusArtistId, focusToken }) => {
  // Lista de artistas que essa conta já criou. Uma conta pode ter vários —
  // por exemplo, alguém populando o catálogo com diferentes artistas
  // fictícios — então em vez de "o meu artista", o app deixa escolher com
  // qual artista (existente ou novo) o envio atual é.
  // Seção fechada por padrão; usuário abre clicando no cabeçalho (ou ela
  // abre sozinha quando alguém pede pra editar um artista específico, veja
  // o efeito de focusArtistId mais abaixo).
  const [isOpen, setIsOpen] = useState(false);
  const [artists, setArtists] = useState<ArtistProfile[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [selectedArtistId, setSelectedArtistId] = useState<string>(NEW_ARTIST);

  const [artistName, setArtistName] = useState(userName);
  const [genre, setGenre] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [items, setItems] = useState<TrackItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const applyArtistToForm = (a: ArtistProfile) => {
    setArtistName(a.name);
    setGenre(a.genre || '');
    setBio(a.bio || '');
    setAvatarPreview(a.avatar_url || null);
    setCoverPreview(a.cover_url || null);
    setAvatarFile(null);
    setCoverFile(null);
  };

  const resetFormForNewArtist = () => {
    setArtistName('');
    setGenre('');
    setBio('');
    setAvatarPreview(null);
    setCoverPreview(null);
    setAvatarFile(null);
    setCoverFile(null);
  };

  // Carrega os artistas que essa conta já tem (se houver, pré-seleciona o
  // mais recente; senão já deixa no modo "criar novo artista").
  useEffect(() => {
    listMyArtists()
      .then((list) => {
        setArtists(list);
        if (list.length > 0) {
          setSelectedArtistId(list[0].id);
          applyArtistToForm(list[0]);
        } else {
          setSelectedArtistId(NEW_ARTIST);
        }
      })
      .catch((err) => setGlobalError(err instanceof Error ? err.message : 'Erro ao carregar seus artistas'))
      .finally(() => setLoadingArtists(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Reage a um pedido de foco vindo de fora (botão "Editar" no painel
  // "Seus Artistas"): seleciona aquele artista aqui e rola a tela até este
  // painel. Depende de focusToken (não só do id) para disparar de novo
  // mesmo que a pessoa clique duas vezes seguidas em "Editar" no mesmo
  // artista — sem isso, um segundo clique não mudaria nada e pareceria
  // que o botão não fez nada.
  useEffect(() => {
    if (!focusArtistId) return;
    const found = artists.find((a) => a.id === focusArtistId);
    if (found) {
      setSelectedArtistId(found.id);
      applyArtistToForm(found);
    }
    setIsOpen(true);
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusArtistId, focusToken, artists]);

  const handleSelectArtist = (value: string) => {
    setSelectedArtistId(value);
    if (value === NEW_ARTIST) {
      resetFormForNewArtist();
      return;
    }
    const found = artists.find((a) => a.id === value);
    if (found) applyArtistToForm(found);
  };

  const handlePickAudio = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith('audio/'));
    const newItems: TrackItem[] = files.map((file) => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, ''),
      coverFile: null,
      coverPreview: null,
      status: 'pending',
      bitrateKbps: undefined,
    }));
    setItems((prev) => [...prev, ...newItems]);

    // Estima o bitrate de cada arquivo em segundo plano (lê metadados no
    // navegador, não sobe nada) e atualiza o item correspondente assim que
    // o resultado chega — sem travar a tela enquanto isso.
    newItems.forEach((newItem) => {
      estimateBitrateKbps(newItem.file)
        .then((kbps) => {
          setItems((prev) =>
            prev.map((it) => (it.file === newItem.file ? { ...it, bitrateKbps: kbps } : it))
          );
        })
        .catch(() => {
          setItems((prev) =>
            prev.map((it) => (it.file === newItem.file ? { ...it, bitrateKbps: null } : it))
          );
        });
    });
  };

  const handlePickTrackCover = (index: number, file: File | null) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, coverFile: file, coverPreview: preview } : it))
    );
  };

  const updateTitle = (index: number, title: string) => {
    setItems((prev) => prev.map((it, idx) => (idx === index ? { ...it, title } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAvatarPick = (file: File | null) => {
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleCoverPick = (file: File | null) => {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSendAll = async () => {
    if (items.length === 0) return;
    if (!artistName.trim()) {
      setGlobalError('Digite um nome artístico antes de enviar.');
      return;
    }
    setIsRunning(true);
    setGlobalError(null);
    setSuccessMessage(null);
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);

    try {
      // 1) Sobe avatar/capa novos, se houver (fica pronto pra usar tanto na
      // criação quanto na atualização do artista).
      const avatarUrl = avatarFile ? await uploadImageFile(avatarFile, 'avatars') : undefined;
      const coverUrl = coverFile ? await uploadImageFile(coverFile, 'covers') : undefined;

      let targetArtistId: string;

      if (selectedArtistId === NEW_ARTIST) {
        // 2a) Cria um artista NOVO e separado. Isso é o que garante que
        // subir música como "Jamba Jô" não reescreve o "Rick Tropical" que
        // já existia — cada nome novo vira seu próprio registro no banco.
        const created = await createArtist({
          nome: artistName,
          genero: genre,
          bio,
          avatarUrl,
          coverUrl,
        });
        targetArtistId = created.id;
        setArtists((prev) => [created, ...prev]);
        setSelectedArtistId(created.id);
      } else {
        // 2b) Atualiza o artista já existente e selecionado (e só ele).
        targetArtistId = selectedArtistId;
        const profileUpdate: { nome: string; genero: string; bio: string; avatarUrl?: string; coverUrl?: string } = {
          nome: artistName,
          genero: genre,
          bio,
        };
        if (avatarUrl) profileUpdate.avatarUrl = avatarUrl;
        if (coverUrl) profileUpdate.coverUrl = coverUrl;
        await updateMyArtistProfile(targetArtistId, profileUpdate);
        setArtists((prev) =>
          prev.map((a) =>
            a.id === targetArtistId
              ? {
                  ...a,
                  name: artistName,
                  genre,
                  bio,
                  avatar_url: avatarUrl || a.avatar_url,
                  cover_url: coverUrl || a.cover_url,
                }
              : a
          )
        );
      }

      if (avatarUrl) setAvatarPreview(avatarUrl);
      if (coverUrl) setCoverPreview(coverUrl);
      setAvatarFile(null);
      setCoverFile(null);

      // 3) Sobe cada música (com capa própria, se tiver), associada ao
      // artista resolvido acima.
      let successCount = 0;
      for (let i = 0; i < items.length; i++) {
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it)));
        try {
          const item = items[i];
          let trackCoverUrl: string | undefined;
          if (item.coverFile) trackCoverUrl = await uploadImageFile(item.coverFile, 'track-covers');
          await uploadTrackFile(item.file, targetArtistId, item.title || item.file.name, trackCoverUrl, (message) => {
            setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, statusText: message } : it)));
          });
          successCount++;
          setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'done' } : it)));
        } catch (err) {
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? { ...it, status: 'error', error: err instanceof Error ? err.message : 'Erro desconhecido' }
                : it
            )
          );
        }
      }

      // 4) Limpa a tela automaticamente: remove as faixas que já foram
      // enviadas com sucesso (as com erro ficam, pra dar pra tentar de novo
      // ou remover manualmente), deixando o painel pronto pra um novo envio.
      setItems((prev) => prev.filter((it) => it.status !== 'done'));
      if (successCount > 0) {
        setSuccessMessage(
          `${successCount} música${successCount === 1 ? '' : 's'} enviada${successCount === 1 ? '' : 's'} como ${artistName}! Volte para a aba Explorar para ouvir.`
        );
        successTimeoutRef.current = setTimeout(() => setSuccessMessage(null), 6000);
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erro ao salvar perfil de artista');
    } finally {
      setIsRunning(false);
      onUploaded?.();
    }
  };

  // Limpa o timeout da mensagem de sucesso ao desmontar o componente.
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  /** Remove as faixas com erro, deixando o painel limpo pra um novo envio. */
  const handleClearErrors = () => {
    setItems((prev) => prev.filter((it) => it.status !== 'error'));
  };

  const errorCount = items.filter((i) => i.status === 'error').length;
  const hasPendingWork = items.some((i) => i.status === 'pending' || i.status === 'uploading');

  return (
    <div ref={rootRef} className="rounded-2xl bg-white shadow-sm p-5 mb-6">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex items-center justify-between w-full mb-1"
      >
        <div className="flex items-center gap-2">
          <UploadCloud size={18} className="text-[#FF8C42]" />
          <h3 className="text-lg font-semibold text-[#1A1B25]">Enviar Músicas</h3>
        </div>
        <ChevronDown
          size={18}
          className={`text-black/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          <p className="text-black/40 text-sm mb-4">
            Áudio: MP3 ou WAV (o que o navegador tocar melhor é MP3). Capas: JPG, PNG ou WEBP.
          </p>

          {globalError && (
            <p className="text-xs text-[#E84393] mb-3">{globalError}</p>
          )}
          {successMessage && (
            <p className="text-xs text-[#00CEC9] mb-3">{successMessage}</p>
          )}

          {/* Escolha de artista: um existente (edita ele) ou um novo (cria um
              registro separado, sem mexer nos outros). */}
          {!loadingArtists && artists.length > 0 && (
        <div className="mb-3">
          <label className="block text-xs text-black/40 mb-1.5">Enviar como</label>
          <select
            value={selectedArtistId}
            onChange={(e) => handleSelectArtist(e.target.value)}
            disabled={isRunning}
            className="w-full rounded-xl bg-[#F7F7FB] border border-black/10 px-3 py-2 text-sm text-[#1A1B25] outline-none focus:border-[#FF8C42]/50"
          >
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value={NEW_ARTIST}>+ Criar novo artista</option>
          </select>
        </div>
      )}

      {/* Perfil do artista */}
      <div className="rounded-xl bg-[#F7F7FB] p-4 mb-4">
        <p className="text-sm font-semibold text-black/70 mb-3">
          {selectedArtistId === NEW_ARTIST ? 'Novo artista' : 'Perfil de artista'}
        </p>

        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="w-14 h-14 rounded-full bg-[#EFF0F6] overflow-hidden flex-shrink-0 flex items-center justify-center"
            aria-label="Escolher avatar"
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus size={18} className="text-black/35" />
            )}
          </button>
          <button
            onClick={() => coverInputRef.current?.click()}
            className="flex-1 h-14 rounded-xl bg-[#EFF0F6] overflow-hidden flex items-center justify-center"
            aria-label="Escolher capa do artista"
          >
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-black/40 flex items-center gap-1">
                <ImagePlus size={14} /> Capa do perfil
              </span>
            )}
          </button>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => handleAvatarPick(e.target.files?.[0] || null)}
        />
        <input
          ref={coverInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => handleCoverPick(e.target.files?.[0] || null)}
        />

        <input
          type="text"
          placeholder="Nome artístico"
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          className="!py-2 !text-sm mb-2"
        />
        <input
          type="text"
          placeholder="Gênero (ex: Indie, Trap, Lo-Fi...)"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="!py-2 !text-sm mb-2"
        />
        <textarea
          placeholder="Bio curta"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={2}
          className="w-full rounded-xl bg-[#F7F7FB] border border-black/10 px-3 py-2 text-sm text-[#1A1B25] placeholder:text-black/30 outline-none focus:border-[#FF8C42]/50 resize-none"
        />
      </div>

      {/* Escolher faixas */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handlePickAudio(e.target.files);
          e.target.value = '';
        }}
      />
      <GradientButton
        variant="outline"
        size="md"
        icon={<Music2 size={18} />}
        onClick={() => audioInputRef.current?.click()}
        className="w-full mb-3"
        disabled={isRunning}
      >
        Adicionar músicas
      </GradientButton>

      {items.length > 0 && (
        <div className="space-y-2 mb-3">
          {items.map((item, idx) => (
            <div key={`${item.file.name}-${idx}`} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#F7F7FB]">
              <button
                onClick={() => document.getElementById(`track-cover-${idx}`)?.click()}
                className="w-10 h-10 rounded-lg bg-[#EFF0F6] overflow-hidden flex-shrink-0 flex items-center justify-center"
                aria-label="Capa da faixa"
                disabled={item.status !== 'pending'}
              >
                {item.coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.coverPreview} alt="Capa" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus size={14} className="text-black/30" />
                )}
              </button>
              <input
                id={`track-cover-${idx}`}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handlePickTrackCover(idx, e.target.files?.[0] || null)}
              />

              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateTitle(idx, e.target.value)}
                  disabled={item.status !== 'pending'}
                  className="w-full !py-1.5 !text-sm"
                />
                {item.status === 'pending' &&
                  item.bitrateKbps != null &&
                  item.bitrateKbps < MIN_RECOMMENDED_KBPS && (
                    <p className="flex items-center gap-1 text-[10px] text-[#E17055] mt-1 leading-tight">
                      <AlertTriangle size={11} className="flex-shrink-0" />
                      ~{item.bitrateKbps}kbps — recomendamos 256kbps ou mais para melhor qualidade
                    </p>
                  )}
              </div>

              {item.status === 'pending' && (
                <button onClick={() => removeItem(idx)} aria-label="Remover" className="text-black/30 hover:text-black/60">
                  <X size={16} />
                </button>
              )}
              {item.status === 'uploading' && (
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  {item.statusText && (
                    <span className="text-[10px] text-black/35 max-w-[120px] truncate">{item.statusText}</span>
                  )}
                  <Loader2 size={16} className="text-[#FF8C42] animate-spin flex-shrink-0" />
                </span>
              )}
              {item.status === 'done' && <CheckCircle2 size={16} className="text-[#00CEC9] flex-shrink-0" />}
              {item.status === 'error' && (
                <button
                  onClick={() => removeItem(idx)}
                  aria-label="Remover (erro no envio)"
                  title={item.error}
                  className="text-[#E84393] hover:text-[#E84393]/70 flex-shrink-0"
                >
                  <XCircle size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {hasPendingWork && (
        <GradientButton
          variant="primary"
          size="md"
          loading={isRunning}
          onClick={handleSendAll}
          className="w-full"
        >
          {isRunning ? 'Enviando...' : `Enviar ${items.length} música${items.length === 1 ? '' : 's'}`}
        </GradientButton>
      )}

      {!hasPendingWork && errorCount > 0 && (
        <div className="pt-1">
          <p className="text-xs text-black/40 mb-2">
            {errorCount} música{errorCount === 1 ? '' : 's'} com erro no envio. Remova ou tente adicionar de novo.
          </p>
          <GradientButton
            variant="outline"
            size="sm"
            onClick={handleClearErrors}
            className="w-full"
          >
            Limpar erros
          </GradientButton>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default UploadMusicPanel;
