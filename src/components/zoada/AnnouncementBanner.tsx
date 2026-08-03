'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { fetchActiveAviso } from '@/lib/api';

/**
 * Banner de aviso global — mostrado no topo da tela inicial (MainScreen)
 * quando o painel de moderação (public/moderacao) publica um aviso (ex:
 * manutenção programada, alerta de golpe circulando, comunicado legal).
 * Some sozinho quando não há nenhum aviso ativo. Fechar é só local (não
 * chama a API) — o aviso continua ativo pra quem reabrir o app depois;
 * só o painel de moderação pode remover de vez.
 */
const DISMISSED_KEY_PREFIX = 'zoada-aviso-dismissed:';

const AnnouncementBanner: React.FC = () => {
  const [aviso, setAviso] = useState<{ id: string; mensagem: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchActiveAviso().then((data) => {
      if (cancelled || !data) return;
      setAviso(data);
      // Cada aviso (por id) só precisa ser fechado uma vez por navegador —
      // se um aviso NOVO for publicado depois, ele volta a aparecer mesmo
      // que o anterior já tivesse sido fechado.
      try {
        setDismissed(sessionStorage.getItem(DISMISSED_KEY_PREFIX + data.id) === '1');
      } catch {
        setDismissed(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!aviso || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY_PREFIX + aviso.id, '1');
    } catch {
      // sem problema se não der pra salvar — só reaparece na próxima visita
    }
  };

  return (
    <div className="flex items-start gap-2.5 mb-3 p-3 rounded-2xl bg-gradient-to-r from-[#FF8C42]/15 via-[#E84393]/15 to-[#6C5CE7]/15 border border-[#FF8C42]/20">
      <Megaphone size={16} className="text-[#E84393] flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-xs text-[#1A1B25] leading-relaxed whitespace-pre-wrap break-words">
        {aviso.mensagem}
      </p>
      <button
        onClick={handleDismiss}
        aria-label="Dispensar aviso"
        className="p-1 rounded-full text-black/30 hover:text-black/60 hover:bg-black/5 flex-shrink-0 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default AnnouncementBanner;
