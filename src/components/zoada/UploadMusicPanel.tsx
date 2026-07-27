'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, Music2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getOrCreateMyArtistId, uploadTrackFile } from '@/lib/trackUpload';
import GradientButton from './GradientButton';

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface UploadMusicPanelProps {
  userName: string;
}

const UploadMusicPanel: React.FC<UploadMusicPanelProps> = ({ userName }) => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).filter((f) => f.type.startsWith('audio/'));
    if (files.length === 0) return;

    const newItems: UploadItem[] = files.map((file) => ({ file, status: 'pending' }));
    setItems(newItems);
    setIsRunning(true);

    try {
      const artistaId = await getOrCreateMyArtistId(userName);

      for (let i = 0; i < files.length; i++) {
        setItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it))
        );
        try {
          await uploadTrackFile(files[i], artistaId);
          setItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: 'done' } : it))
          );
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
    } catch (err) {
      // Falha ao criar/achar o artista — marca tudo como erro
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setItems((prev) => prev.map((it) => ({ ...it, status: 'error', error: message })));
    } finally {
      setIsRunning(false);
    }
  };

  const doneCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const allFinished = items.length > 0 && !isRunning;

  return (
    <div className="rounded-2xl bg-[#1E2030] p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <UploadCloud size={18} className="text-[#FF8C42]" />
        <h3 className="text-lg font-semibold text-white">Enviar Músicas</h3>
      </div>
      <p className="text-white/40 text-sm mb-4">
        Escolha um ou vários arquivos de áudio (MP3, WAV...). Cada um vira uma faixa de
        verdade, com upload pro R2 e registro no banco.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <GradientButton
        variant="outline"
        size="md"
        icon={<Music2 size={18} />}
        loading={isRunning}
        onClick={() => inputRef.current?.click()}
        className="w-full"
      >
        {isRunning ? 'Enviando...' : 'Escolher músicas'}
      </GradientButton>

      {items.length > 0 && (
        <div className="mt-4 space-y-2">
          {items.map((item, idx) => (
            <div
              key={`${item.file.name}-${idx}`}
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5"
            >
              {item.status === 'pending' && <Music2 size={16} className="text-white/30 flex-shrink-0" />}
              {item.status === 'uploading' && (
                <Loader2 size={16} className="text-[#FF8C42] flex-shrink-0 animate-spin" />
              )}
              {item.status === 'done' && (
                <CheckCircle2 size={16} className="text-[#00CEC9] flex-shrink-0" />
              )}
              {item.status === 'error' && <XCircle size={16} className="text-[#E84393] flex-shrink-0" />}

              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.file.name}</p>
                {item.status === 'error' && (
                  <p className="text-xs text-[#E84393] truncate">{item.error}</p>
                )}
              </div>
            </div>
          ))}

          {allFinished && (
            <p className="text-xs text-white/40 pt-1">
              {doneCount} enviada{doneCount === 1 ? '' : 's'} com sucesso
              {errorCount > 0 ? ` · ${errorCount} com erro` : ''}. Volte para a aba{' '}
              <span className="text-white/60">Explorar</span> para ouvir.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadMusicPanel;
