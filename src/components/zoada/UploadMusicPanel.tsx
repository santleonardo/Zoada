'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, Music2, CheckCircle2, XCircle, Loader2, ImagePlus, X } from 'lucide-react';
import {
  getOrCreateMyArtistId,
  getMyArtistProfile,
  updateMyArtistProfile,
  uploadImageFile,
  uploadTrackFile,
} from '@/lib/trackUpload';
import GradientButton from './GradientButton';

interface TrackItem {
  file: File;
  title: string;
  coverFile: File | null;
  coverPreview: string | null;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface UploadMusicPanelProps {
  userName: string;
  onProfileChange?: (avatarUrl: string | null, coverUrl: string | null) => void;
  /** Chamado sempre que um envio termina (com sucesso ou erro), pra quem
   * estiver de fora (ex: a lista de "músicas enviadas") poder se atualizar. */
  onUploaded?: () => void;
}

const UploadMusicPanel: React.FC<UploadMusicPanelProps> = ({ userName, onProfileChange, onUploaded }) => {
  const [artistaId, setArtistaId] = useState<string | null>(null);
  const [artistName, setArtistName] = useState(userName);
  const [genre, setGenre] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  // Guarda a última URL "real" (do servidor, não um blob local) de avatar/capa,
  // pra sempre avisar o componente pai com o valor certo — mesmo quando essa
  // execução do envio não trocou uma das duas imagens.
  const lastKnownAvatarUrl = useRef<string | null>(null);
  const lastKnownCoverUrl = useRef<string | null>(null);

  const [items, setItems] = useState<TrackItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Carrega o perfil de artista existente (se já tiver enviado música antes)
  useEffect(() => {
    getOrCreateMyArtistId(userName)
      .then(async (id) => {
        setArtistaId(id);
        const profile = await getMyArtistProfile(id);
        if (profile) {
          setArtistName(profile.name || userName);
          setGenre(profile.genre || '');
          setBio(profile.bio || '');
          setAvatarPreview(profile.avatar_url || null);
          setCoverPreview(profile.cover_url || null);
          lastKnownAvatarUrl.current = profile.avatar_url || null;
          lastKnownCoverUrl.current = profile.cover_url || null;
          onProfileChange?.(profile.avatar_url || null, profile.cover_url || null);
        }
      })
      .catch((err) => setGlobalError(err instanceof Error ? err.message : 'Erro ao carregar perfil'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickAudio = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith('audio/'));
    const newItems: TrackItem[] = files.map((file) => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, ''),
      coverFile: null,
      coverPreview: null,
      status: 'pending',
    }));
    setItems((prev) => [...prev, ...newItems]);
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
    if (!artistaId || items.length === 0) return;
    setIsRunning(true);
    setGlobalError(null);
    setSuccessMessage(null);
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);

    try {
      // 1) Salva o perfil do artista (nome/gênero/bio + imagens, se trocadas)
      const profileUpdate: { nome: string; genero: string; bio: string; avatarUrl?: string; coverUrl?: string } = {
        nome: artistName,
        genero: genre,
        bio,
      };
      if (avatarFile) profileUpdate.avatarUrl = await uploadImageFile(avatarFile, 'avatars');
      if (coverFile) profileUpdate.coverUrl = await uploadImageFile(coverFile, 'covers');
      await updateMyArtistProfile(artistaId, profileUpdate);

      // 2) Sobe cada música (com capa própria, se tiver)
      let successCount = 0;
      for (let i = 0; i < items.length; i++) {
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it)));
        try {
          const item = items[i];
          let trackCoverUrl: string | undefined;
          if (item.coverFile) trackCoverUrl = await uploadImageFile(item.coverFile, 'track-covers');
          await uploadTrackFile(item.file, artistaId, item.title || item.file.name, trackCoverUrl);
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

      // 3) Busca o perfil salvo de novo no servidor: troca os previews (que até
      // aqui eram só blobs locais) pelas URLs reais, limpa os arquivos já
      // enviados (senão eles seriam reenviados à toa no próximo envio) e avisa
      // o componente pai. É isso que efetivamente "atualiza a tela".
      const freshProfile = await getMyArtistProfile(artistaId);
      if (freshProfile) {
        setAvatarPreview(freshProfile.avatar_url || null);
        setCoverPreview(freshProfile.cover_url || null);
        lastKnownAvatarUrl.current = freshProfile.avatar_url || null;
        lastKnownCoverUrl.current = freshProfile.cover_url || null;
        onProfileChange?.(freshProfile.avatar_url || null, freshProfile.cover_url || null);
      }
      setAvatarFile(null);
      setCoverFile(null);

      // 4) Limpa a tela automaticamente: remove as faixas que já foram enviadas
      // com sucesso (as com erro ficam, pra dar pra tentar de novo ou remover
      // manualmente), deixando o painel pronto pra um novo envio na hora.
      setItems((prev) => prev.filter((it) => it.status !== 'done'));
      if (successCount > 0) {
        setSuccessMessage(
          `${successCount} música${successCount === 1 ? '' : 's'} enviada${successCount === 1 ? '' : 's'} com sucesso! Volte para a aba Explorar para ouvir.`
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
    <div className="rounded-2xl bg-[#1E2030] p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <UploadCloud size={18} className="text-[#FF8C42]" />
        <h3 className="text-lg font-semibold text-white">Enviar Músicas</h3>
      </div>
      <p className="text-white/40 text-sm mb-4">
        Áudio: MP3 ou WAV (o que o navegador tocar melhor é MP3). Capas: JPG, PNG ou WEBP.
      </p>

      {globalError && (
        <p className="text-xs text-[#E84393] mb-3">{globalError}</p>
      )}
      {successMessage && (
        <p className="text-xs text-[#00CEC9] mb-3">{successMessage}</p>
      )}

      {/* Perfil do artista */}
      <div className="rounded-xl bg-white/5 p-4 mb-4">
        <p className="text-sm font-semibold text-white/80 mb-3">Perfil de artista</p>

        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="w-14 h-14 rounded-full bg-[#252840] overflow-hidden flex-shrink-0 flex items-center justify-center"
            aria-label="Escolher avatar"
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus size={18} className="text-white/40" />
            )}
          </button>
          <button
            onClick={() => coverInputRef.current?.click()}
            className="flex-1 h-14 rounded-xl bg-[#252840] overflow-hidden flex items-center justify-center"
            aria-label="Escolher capa do artista"
          >
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-white/40 flex items-center gap-1">
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
          className="w-full rounded-xl bg-[#252840] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF8C42]/50 resize-none"
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
            <div key={`${item.file.name}-${idx}`} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
              <button
                onClick={() => document.getElementById(`track-cover-${idx}`)?.click()}
                className="w-10 h-10 rounded-lg bg-[#252840] overflow-hidden flex-shrink-0 flex items-center justify-center"
                aria-label="Capa da faixa"
                disabled={item.status !== 'pending'}
              >
                {item.coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.coverPreview} alt="Capa" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus size={14} className="text-white/30" />
                )}
              </button>
              <input
                id={`track-cover-${idx}`}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handlePickTrackCover(idx, e.target.files?.[0] || null)}
              />

              <input
                type="text"
                value={item.title}
                onChange={(e) => updateTitle(idx, e.target.value)}
                disabled={item.status !== 'pending'}
                className="flex-1 min-w-0 !py-1.5 !text-sm"
              />

              {item.status === 'pending' && (
                <button onClick={() => removeItem(idx)} aria-label="Remover" className="text-white/30 hover:text-white/60">
                  <X size={16} />
                </button>
              )}
              {item.status === 'uploading' && <Loader2 size={16} className="text-[#FF8C42] animate-spin flex-shrink-0" />}
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
          <p className="text-xs text-white/40 mb-2">
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
    </div>
  );
};

export default UploadMusicPanel;
