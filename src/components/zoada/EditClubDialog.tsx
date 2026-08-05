'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, Camera, Loader2, Users as UsersIcon, Trash2, Lock, Eye, EyeOff } from 'lucide-react';
import type { Club } from '@/types';
import { uploadClubCover, updateClub, deleteClub } from '@/lib/api';

interface EditClubDialogProps {
  open: boolean;
  club: Club | null;
  onClose: () => void;
  onSaved: (club: Club) => void;
  /** Chamado depois que o admin confirma e a exclusão do clube dá certo. */
  onDeleted?: (clubId: string) => void;
}

/**
 * Dialog de edição de um clube (só pro admin) — nome, bio/descrição e foto
 * de capa. Espelha o EditProfileDialog, só que trocando avatar de usuário
 * por capa de clube e persistindo via updateClub/uploadClubCover.
 * Também expõe a exclusão do clube (soft-delete, 30 dias).
 */
const EditClubDialog: React.FC<EditClubDialogProps> = ({ open, club, onClose, onSaved, onDeleted }) => {
  const [name, setName] = useState(club?.name || '');
  const [description, setDescription] = useState(club?.description || '');
  const [coverPreview, setCoverPreview] = useState<string | null>(club?.cover_url || null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  // Senha de entrada: o valor atual (hash) nunca chega no cliente, então
  // só sabemos se ELA EXISTE (club.has_password). Digitar um valor novo
  // troca a senha; desligar o toggle remove a proteção.
  const [passwordEnabled, setPasswordEnabled] = useState(!!club?.has_password);
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      setPasswordEnabled(!!club?.has_password);
      setPasswordValue('');
      setShowPassword(false);
      setError(null);
      setIsUploading(false);
      setIsSaving(false);
      setIsDeleting(false);
      setConfirmDelete(false);
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

    // Determina o que mandar pro campo `password`: undefined = não mexe,
    // '' = remove a proteção, string = define/troca a senha.
    let passwordField: string | undefined;
    if (!passwordEnabled) {
      passwordField = club.has_password ? '' : undefined;
    } else if (passwordValue.trim()) {
      if (passwordValue.trim().length < 4) {
        setError('A senha precisa ter pelo menos 4 caracteres.');
        return;
      }
      passwordField = passwordValue.trim();
    } else if (!club.has_password) {
      setError('Digite uma senha para exigir na entrada.');
      return;
    } else {
      passwordField = undefined; // já tinha senha e o admin não digitou uma nova — mantém
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
        password: passwordField,
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

  const handleDelete = async () => {
    if (!club) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setError(null);
    setIsDeleting(true);
    try {
      const ok = await deleteClub(club.id);
      if (!ok) {
        setError('Não foi possível excluir o clube. Tente novamente.');
        setIsDeleting(false);
        setConfirmDelete(false);
        return;
      }
      onDeleted?.(club.id);
      onClose();
    } catch {
      setError('Erro inesperado ao excluir. Tente novamente.');
      setConfirmDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!open || !club) return null;

  const noChanges =
    !coverFile &&
    !removeCover &&
    name.trim() === (club.name || '') &&
    description.trim() === (club.description || '') &&
    passwordEnabled === club.has_password &&
    !passwordValue.trim();

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

          {/* Senha de entrada */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-black/5 flex items-center justify-center flex-shrink-0">
                  <Lock size={16} className="text-[#1A1B25]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1A1B25]">Senha de entrada</p>
                  <p className="text-xs text-black/45 mt-0.5 leading-relaxed">
                    Quando ativada, quem quiser entrar no clube sozinho (sem convite) precisa
                    informar essa senha.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={passwordEnabled}
                onClick={() => {
                  setPasswordEnabled((v) => !v);
                  setPasswordValue('');
                }}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  passwordEnabled ? 'bg-[#FF8C42]' : 'bg-black/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    passwordEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {passwordEnabled && (
              <div className="mt-3 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value.slice(0, 60))}
                  placeholder={club.has_password ? 'Digite pra trocar a senha atual' : 'Crie uma senha (mín. 4 caracteres)'}
                  className="w-full pl-4 pr-10 py-3 rounded-xl bg-white border border-black/10 focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none text-sm text-[#1A1B25] placeholder:text-black/25 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/50"
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Zona de perigo — excluir clube */}
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
            <p className="text-sm font-semibold text-red-700">Excluir clube</p>
            <p className="text-xs text-red-600/80 mt-1 leading-relaxed">
              O clube some para todos os membros. Essa ação não pode ser desfeita pelo app.
            </p>
            {confirmDelete ? (
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-xs font-medium text-red-700">
                  Tem certeza? Confirme para excluir &ldquo;{club.name}&rdquo;.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl bg-white border border-black/10 text-xs font-medium text-[#1A1B25] hover:bg-black/5 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting || isSaving}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isDeleting && <Loader2 size={12} className="animate-spin" />}
                    {isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
                className="mt-3 w-full py-2.5 rounded-xl border border-red-300 bg-white text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} />
                Excluir este clube
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-black/5 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving || isDeleting}
            className="flex-1 py-3 rounded-xl bg-black/5 hover:bg-black/10 text-sm font-medium text-[#1A1B25] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isDeleting || noChanges}
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
