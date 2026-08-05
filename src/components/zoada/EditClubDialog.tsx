'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, Camera, Loader2, Users as UsersIcon, Trash2 } from 'lucide-react';
import type { Club } from '@/types';
import { uploadClubCover, updateClub } from '@/lib/api';

interface EditClubDialogProps {
  open: boolean;
  club: Club | null;
  onClose: () => void;
  onSaved: (club: Club) => void;
}

/**
 * Dialog de edição de um clube (só pro admin) — nome, bio/descrição e foto
 * de capa. Espelha o EditProfileDialog, só que trocando avatar de usuário
 * por capa de clube e persistindo via updateClub/uploadClubCover.
 */
const EditClubDialog: React.FC<EditClubDialogProps> = ({ open, club, onClose, onSaved }) => {
  const [name, setName] = useState(club?.name || '');
  const [description, setDescription] = useState(club?.description || '');
  const [coverPreview, setCoverPreview] = useState<string | null>(club?.cover_url || null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reseta o estado toda vez que o dialog abre (ou troca de clube).
  React.useEffect(() => {
    if (open) {
      setName(club?.name || '');
      setDescription(club?.description || '');
      setCoverPreview(club?.cover_url || null);
      setCoverFile(null);
      setRemoveCover(false);
      setError(null);
      setIsUploading(false);
      setIsSaving(false);
    }
  }, [open, club]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Use JPG, PNG, GIF ou WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem muito grande (máx 5MB).');
      return;
    }

    setError(null);
    setCoverFile(file);
    setRemoveCover(false);

    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveCover = useCallback(() => {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleSave = async () => {
    if (!club) return;
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('O clube precisa de um nome.');
      return;
    }

    setIsSaving(true);

    try {
      let finalCoverUrl: string | null = club.cover_url;

      if (coverFile) {
        setIsUploading(true);
        const uploadedUrl = await uploadClubCover(club.id, coverFile);
        setIsUploading(false);
        if (!uploadedUrl) {
          setError('Erro ao fazer upload da capa. Tente novamente.');
          setIsSaving(false);
          return;
        }
        finalCoverUrl = uploadedUrl;
      }

      if (removeCover) {
        finalCoverUrl = null;
      }

      const updated = await updateClub(club.id, {
        name: trimmedName,
        description,
        cover_url: finalCoverUrl,
      });

      if (!updated) {
        setError('Erro ao salvar. Tente novamente.');
        setIsSaving(false);
        return;
      }

      onSaved(updated);
      onClose();
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  if (!open || !club) return null;

  const noChanges =
    !coverFile &&
    !removeCover &&
    name.trim() === (club.name || '') &&
    description.trim() === (club.description || '');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-[#F7F7FB] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <h2 className="text-lg font-bold text-[#1A1B25]">Editar Clube</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <X size={16} className="text-black/50" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Foto de capa */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden gradient-bg flex items-center justify-center shadow-lg">
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverPreview}
                    alt="Foto de capa do clube"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UsersIcon size={32} className="text-white" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#EFF0F6] border-2 border-[#F7F7FB] shadow-sm flex items-center justify-center hover:bg-[#E4E5EE] transition-colors disabled:opacity-50"
                aria-label="Trocar foto de capa"
              >
                {isUploading ? (
                  <Loader2 size={14} className="text-[#1A1B25] animate-spin" />
                ) : (
                  <Camera size={14} className="text-[#1A1B25]" />
                )}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            {coverPreview && (
              <button
                onClick={handleRemoveCover}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 size={12} />
                Remover foto
              </button>
            )}
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <label htmlFor="club-name" className="block text-sm font-medium text-[#1A1B25]">
              Nome do clube
            </label>
            <input
              id="club-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              maxLength={60}
              placeholder="Nome do clube"
              className="w-full px-4 py-3 rounded-xl bg-white border border-black/10 focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none text-sm text-[#1A1B25] placeholder:text-black/25 transition-all"
            />
          </div>

          {/* Bio / descrição */}
          <div className="space-y-2">
            <label htmlFor="club-description" className="block text-sm font-medium text-[#1A1B25]">
              Bio
            </label>
            <textarea
              id="club-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 280))}
              maxLength={280}
              rows={3}
              placeholder="Conte do que se trata o clube..."
              className="w-full px-4 py-3 rounded-xl bg-white border border-black/10 focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none text-sm text-[#1A1B25] placeholder:text-black/25 transition-all resize-none"
            />
            <p className="text-right text-[11px] text-black/30">{description.length}/280</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-black/5 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl bg-black/5 hover:bg-black/10 text-sm font-medium text-[#1A1B25] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || noChanges}
            className="flex-1 py-3 rounded-xl gradient-bg text-sm font-medium text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            {isUploading ? 'Enviando foto...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditClubDialog;
