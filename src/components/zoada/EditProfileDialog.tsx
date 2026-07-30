'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  X,
  Camera,
  Loader2,
  User as UserIcon,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { uploadAvatar } from '@/lib/api';
import { getAuthToken } from '@/lib/api';

interface EditProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

const EditProfileDialog: React.FC<EditProfileDialogProps> = ({ open, onClose }) => {
  const { user, updateProfile } = useAppStore();
  const [name, setName] = useState(user?.name || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reseta o estado ao abrir o dialog
  React.useEffect(() => {
    if (open) {
      setName(user?.name || '');
      setAvatarPreview(user?.avatar_url || null);
      setAvatarFile(null);
      setRemoveAvatar(false);
      setError(null);
      setIsUploading(false);
      setIsSaving(false);
    }
  }, [open, user?.name, user?.avatar_url]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Use JPG, PNG, GIF ou WebP.');
      return;
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem muito grande (máx 5MB).');
      return;
    }

    setError(null);
    setAvatarFile(file);
    setRemoveAvatar(false);

    // Preview local
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveAvatar = useCallback(() => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleSave = async () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nome não pode ficar vazio.');
      return;
    }

    setIsSaving(true);

    try {
      let finalAvatarUrl: string | null = user?.avatar_url || null;

      // Se o usuário selecionou um novo arquivo, faz upload
      if (avatarFile) {
        setIsUploading(true);
        const token = getAuthToken();
        // Em modo demo (sem token real), usa o preview como data URL
        if (!token || token === 'demo') {
          finalAvatarUrl = avatarPreview;
        } else {
          const uploadedUrl = await uploadAvatar(avatarFile);
          if (!uploadedUrl) {
            setError('Erro ao fazer upload da foto. Tente novamente.');
            setIsUploading(false);
            setIsSaving(false);
            return;
          }
          finalAvatarUrl = uploadedUrl;
        }
        setIsUploading(false);
      }

      // Se o usuário pediu pra remover
      if (removeAvatar) {
        finalAvatarUrl = null;
      }

      // Envia atualização pro servidor
      const success = await updateProfile({
        name: trimmedName,
        avatar_url: finalAvatarUrl,
      });

      if (!success) {
        setError('Erro ao salvar. Tente novamente.');
        setIsSaving(false);
        return;
      }

      onClose();
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  if (!open) return null;

  const initials = (name || user?.name || '??')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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
          <h2 className="text-lg font-bold text-[#1A1B25]">Editar Perfil</h2>
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
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden gradient-bg flex items-center justify-center shadow-lg">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-white">{initials}</span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#EFF0F6] border-2 border-[#F7F7FB] shadow-sm flex items-center justify-center hover:bg-[#E4E5EE] transition-colors disabled:opacity-50"
                aria-label="Trocar foto"
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
            {avatarPreview && (
              <button
                onClick={handleRemoveAvatar}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 size={12} />
                Remover foto
              </button>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label
              htmlFor="profile-name"
              className="block text-sm font-medium text-[#1A1B25]"
            >
              Nome
            </label>
            <div className="relative">
              <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/25" />
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Seu nome"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-black/10 focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none text-sm text-[#1A1B25] placeholder:text-black/25 transition-all"
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#1A1B25]">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              className="w-full px-4 py-3 rounded-xl bg-black/5 border border-black/5 text-sm text-black/40 cursor-not-allowed"
            />
            <p className="text-xs text-black/25">O email não pode ser alterado.</p>
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
            disabled={isSaving || (!avatarFile && !removeAvatar && name.trim() === user?.name)}
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

export default EditProfileDialog;
