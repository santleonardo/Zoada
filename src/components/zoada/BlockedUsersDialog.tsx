'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, UserX, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { fetchBlockedUsers, toggleBlockUser, type BlockedUser } from '@/lib/api';

interface BlockedUsersDialogProps {
  open: boolean;
  onClose: () => void;
}

// Painel "Usuários bloqueados" — lista quem o usuário logado bloqueou, com
// opção de desbloquear a qualquer momento. Bloquear em si é feito na hora
// (na conversa ou no perfil da pessoa); aqui é só o gerenciamento depois.
const BlockedUsersDialog: React.FC<BlockedUsersDialogProps> = ({ open, onClose }) => {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchBlockedUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const handleUnblock = async (u: BlockedUser) => {
    setUnblockingId(u.id);
    const result = await toggleBlockUser(u.id);
    setUnblockingId(null);

    if (typeof result === 'string') {
      toast.error(result);
      return;
    }
    if (!result.blocked) {
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success(`${u.name || 'Usuário'} desbloqueado(a).`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-[#F7F7FB] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-black/5 sticky top-0 bg-[#F7F7FB] z-10">
          <h2 className="text-lg font-bold text-[#1A1B25] flex items-center gap-2">
            <ShieldOff size={18} className="text-black/40" />
            Usuários bloqueados
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <X size={16} className="text-black/50" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-black/45 leading-relaxed -mt-1">
            Quem você bloqueia não consegue te enviar mensagens nem aparece nas suas buscas — e o
            contrário também vale enquanto o bloqueio durar.
          </p>

          {loading && (
            <div className="flex items-center justify-center py-10 text-black/30">
              <Loader2 size={22} className="animate-spin" />
            </div>
          )}

          {!loading && users.length === 0 && (
            <div className="text-center py-10">
              <UserX size={32} className="text-black/15 mx-auto mb-2" />
              <p className="text-sm text-black/40">Você não bloqueou ninguém ainda.</p>
            </div>
          )}

          {!loading &&
            users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm">
                <div className="w-10 h-10 rounded-full bg-[#EFF0F6] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-black/60">{(u.name || '?').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1B25] truncate">{u.name || 'Usuário'}</p>
                </div>
                <button
                  onClick={() => handleUnblock(u)}
                  disabled={unblockingId === u.id}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-xs font-semibold text-[#1A1B25] transition-colors disabled:opacity-50"
                >
                  {unblockingId === u.id && <Loader2 size={13} className="animate-spin" />}
                  Desbloquear
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default BlockedUsersDialog;
