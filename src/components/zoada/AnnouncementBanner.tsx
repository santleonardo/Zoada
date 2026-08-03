'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone, ChevronDown } from 'lucide-react';
import { fetchActiveAviso } from '@/lib/api';

/**
 * Banner de aviso global — mostrado no topo da tela inicial (MainScreen)
 * quando o painel de moderação (public/moderacao) publica um aviso (ex:
 * manutenção programada, alerta de golpe circulando, comunicado legal).
 *
 * Clicar em "Ok" NÃO remove o aviso — só recolhe pra uma faixinha
 * clicável no mesmo lugar, que a pessoa pode abrir de novo quando quiser
 * reler. O aviso só some de vez do app quando o painel de moderação
 * remove ele (aí a API para de retornar esse aviso como ativo).
 */
const COLLAPSED_KEY_PREFIX = 'zoada-aviso-recolhido:';

const AnnouncementBanner: React.FC = () => {
  const [aviso, setAviso] = useState<{ id: string; mensagem: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchActiveAviso().then((data) => {
      if (cancelled) return;
      setAviso(data);
      if (!data) return;
      // Cada aviso (por id) lembra se a pessoa já tinha recolhido ele
      // nesse navegador — mas continua acessível, só que recolhido, em
      // vez de sumir. Se um aviso NOVO for publicado, ele vem aberto.
      try {
        setCollapsed(sessionStorage.getItem(COLLAPSED_KEY_PREFIX + data.id) === '1');
      } catch {
        setCollapsed(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!aviso) return null;

  const persistCollapsed = (value: boolean) => {
    setCollapsed(value);
    try {
      sessionStorage.setItem(COLLAPSED_KEY_PREFIX + aviso.id, value ? '1' : '0');
    } catch {
      // sem problema se não der pra salvar — só volta a vir aberto da próxima vez
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={() => persistCollapsed(false)}
        className="w-full flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-black/5 hover:bg-black/10 text-left transition-colors"
      >
        <Megaphone size={13} className="text-[#E84393] flex-shrink-0" />
        <span className="flex-1 text-xs font-medium text-black/60 truncate">Aviso — toque para ler</span>
        <ChevronDown size={14} className="text-black/30 flex-shrink-0" />
      </button>
    );
  }

  return (
    <div className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-[#FF8C42]/15 via-[#E84393]/15 to-[#6C5CE7]/15 border border-[#FF8C42]/20">
      <div className="flex items-start gap-2.5">
        <Megaphone size={16} className="text-[#E84393] flex-shrink-0 mt-0.5" />
        <p className="flex-1 text-xs text-[#1A1B25] leading-relaxed whitespace-pre-wrap break-words">
          {aviso.mensagem}
        </p>
      </div>
      <div className="flex justify-end mt-2.5">
        <button
          onClick={() => persistCollapsed(true)}
          className="px-4 py-1.5 rounded-full gradient-bg text-xs font-semibold text-white hover:opacity-90 active:scale-95 transition-all"
        >
          Ok
        </button>
      </div>
    </div>
  );
};

export default AnnouncementBanner;
