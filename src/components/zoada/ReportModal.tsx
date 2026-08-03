'use client';

import React, { useState } from 'react';
import { X, Flag, Loader2, CheckCircle2 } from 'lucide-react';
import { reportContent, type ReportTargetType } from '@/lib/api';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  /** Tipo do conteúdo denunciado (precisa bater com o enum da API). */
  targetType: ReportTargetType;
  /** ID do conteúdo denunciado (postagem, comentário, faixa ou usuário). */
  targetId: string;
}

// Motivos pré-definidos — cobrem os riscos mapeados na pesquisa jurídica
// (direitos autorais, ilícitos em geral, e o caso mais grave: abuso/
// exploração infantil, que a ECA Digital exige remover e notificar
// autoridades imediatamente).
const MOTIVOS = [
  'Spam ou golpe',
  'Discurso de ódio ou assédio',
  'Violação de direitos autorais',
  'Abuso, aliciamento ou exploração de crianças e adolescentes',
  'Conteúdo ilícito ou perigoso',
  'Outro',
];

/**
 * Modal de denúncia — canal de reporte pedido pela pesquisa jurídica
 * (Marco Civil pós-decisão do STF de 2025): hoje o único jeito de "sumir"
 * com conteúdo era o próprio dono apagar; isso permite que qualquer
 * usuário logado denuncie posts, comentários, faixas ou perfis de
 * terceiros, indo parar no painel de moderação (public/moderacao).
 */
const ReportModal: React.FC<ReportModalProps> = ({ open, onClose, targetType, targetId }) => {
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const reset = () => {
    setMotivo('');
    setDescricao('');
    setError(null);
    setSent(false);
    setSending(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSend = async () => {
    if (!motivo || sending) return;
    setSending(true);
    setError(null);

    const result = await reportContent(targetType, targetId, motivo, descricao.trim() || undefined);

    setSending(false);
    if (result !== true) {
      setError(result);
      return;
    }
    setSent(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />

      <div className="relative bg-[#F7F7FB] w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <h2 className="text-lg font-bold text-[#1A1B25] flex items-center gap-2">
            <Flag size={16} className="text-[#E84393]" />
            Denunciar
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <X size={16} className="text-black/50" />
          </button>
        </div>

        {sent ? (
          <div className="p-6 flex flex-col items-center text-center gap-3">
            <CheckCircle2 size={36} className="text-green-500" />
            <p className="text-sm text-[#1A1B25] font-medium">Denúncia enviada</p>
            <p className="text-xs text-black/40">
              Nossa equipe vai analisar em breve. Obrigado por ajudar a manter o Zôada seguro.
            </p>
            <button
              onClick={handleClose}
              className="mt-2 w-full py-3 rounded-xl gradient-bg text-sm font-medium text-white hover:opacity-90 transition-all"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#1A1B25]">Por que você está denunciando?</label>
                <div className="space-y-1.5">
                  {MOTIVOS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMotivo(m)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm border transition-colors ${
                        motivo === m
                          ? 'border-[#FF8C42] bg-[#FF8C42]/10 text-[#1A1B25] font-medium'
                          : 'border-black/10 bg-white text-black/60 hover:border-black/20'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="report-descricao" className="block text-sm font-medium text-[#1A1B25]">
                  Detalhes (opcional)
                </label>
                <textarea
                  id="report-descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value.slice(0, 1000))}
                  rows={3}
                  placeholder="Conte mais sobre o que aconteceu..."
                  className="w-full px-4 py-3 rounded-xl bg-white border border-black/10 focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none text-sm text-[#1A1B25] placeholder:text-black/25 transition-all resize-none"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-black/5 flex gap-3">
              <button
                onClick={handleClose}
                disabled={sending}
                className="flex-1 py-3 rounded-xl bg-black/5 hover:bg-black/10 text-sm font-medium text-[#1A1B25] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !motivo}
                className="flex-1 py-3 rounded-xl gradient-bg text-sm font-medium text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending && <Loader2 size={14} className="animate-spin" />}
                Enviar denúncia
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
