'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, Loader2, Lock } from 'lucide-react';
import { getAuthToken } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';

interface DeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

// Confirmação de exclusão de conta — item 8 da Política de Privacidade
// ("como excluir sua conta ou seus dados"). Pede a senha atual porque é
// uma ação irreversível (apaga faixas, posts, mensagens, tudo). Ao
// concluir, desloga o usuário direto, já que a conta deixou de existir.
const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({ open, onClose }) => {
  const { logout } = useAppStore();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleClose = () => {
    if (loading) return;
    setPassword('');
    setError('');
    onClose();
  };

  const handleDelete = async () => {
    if (!password) {
      setError('Digite sua senha para confirmar');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const token = getAuthToken();
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Não foi possível excluir sua conta');
        setLoading(false);
        return;
      }

      // Conta apagada de fato — não há mais sessão pra manter.
      logout();
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="relative bg-[#F7F7FB] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <h2 className="text-lg font-bold text-[#1A1B25]">Excluir conta</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <X size={16} className="text-black/50" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 leading-relaxed">
              Isso apaga sua conta e todos os seus dados: faixas enviadas, posts, comentários,
              mensagens, curtidas e favoritos. <strong>Não é possível desfazer.</strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-black/50 mb-1.5">
              Digite sua senha para confirmar
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
                className="!pl-10 w-full"
                disabled={loading}
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-white border border-black/10 text-sm font-semibold text-[#1A1B25] hover:bg-[#F2F2F8] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-red-500 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Excluindo...' : 'Excluir conta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountDialog;
