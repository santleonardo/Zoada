'use client';

import React, { useEffect, useState } from 'react';
import { X, UserPlus, Search, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { searchUsers, inviteClubMember } from '@/lib/api';
import type { UserSearchResult, ClubMember } from '@/types';
import CoverArt from './CoverArt';

interface ClubInviteModalProps {
  open: boolean;
  onClose: () => void;
  clubId: string;
  /** IDs de quem já é membro, pra não oferecer convidar de novo. */
  memberIds: string[];
  /** Chamado com o novo membro assim que o convite é confirmado pelo servidor. */
  onInvited: (member: ClubMember) => void;
}

/**
 * Convite de membros pro clube: busca por nome (mesma rota da aba "Fãs")
 * e adiciona a pessoa direto na comunidade — sem fluxo de aceitar/recusar,
 * pra manter a estrutura básica simples. Só quem já é admin do clube
 * consegue abrir esse modal com sucesso (a API também garante isso).
 */
const ClubInviteModal: React.FC<ClubInviteModalProps> = ({ open, onClose, clubId, memberIds, onInvited }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setInvitedIds([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timeout = setTimeout(() => {
      searchUsers(query)
        .then(setResults)
        .finally(() => setIsSearching(false));
    }, 350);
    return () => clearTimeout(timeout);
  }, [open, query]);

  const handleInvite = async (userId: string) => {
    if (invitingId) return;
    setInvitingId(userId);
    const member = await inviteClubMember(clubId, userId);
    setInvitingId(null);

    if (!member) {
      toast.error('Não foi possível convidar esse fã. Tente novamente.');
      return;
    }
    setInvitedIds((prev) => [...prev, userId]);
    onInvited(member);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-[#F7F7FB] w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <h2 className="text-lg font-bold text-[#1A1B25] flex items-center gap-2">
            <UserPlus size={16} className="text-[#FF8C42]" />
            Convidar membros
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
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/25" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar fã por nome..."
              className="w-full !pl-8 !py-2 !text-sm !bg-white"
            />
          </div>

          {isSearching && (
            <p className="text-center text-black/40 text-sm py-4">Buscando...</p>
          )}

          {!isSearching && query.trim() && results.length === 0 && (
            <p className="text-center text-black/40 text-sm py-4">Nenhum fã encontrado com esse nome</p>
          )}

          <div className="space-y-1.5">
            {!isSearching &&
              results.map((fan) => {
                const isMember = memberIds.includes(fan.id) || invitedIds.includes(fan.id);
                return (
                  <div
                    key={fan.id}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white shadow-sm"
                  >
                    <CoverArt
                      title={fan.name}
                      artistName=""
                      coverUrl={fan.avatar_url || ''}
                      size="sm"
                      className="!w-10 !h-10 !max-w-none !rounded-full flex-shrink-0"
                    />
                    <span className="flex-1 min-w-0 text-sm font-medium text-[#1A1B25] truncate">
                      {fan.name}
                    </span>
                    {isMember ? (
                      <span className="flex items-center gap-1 text-xs text-black/30 font-medium px-2">
                        <Check size={13} />
                        No clube
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInvite(fan.id)}
                        disabled={invitingId === fan.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full gradient-bg text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-40"
                      >
                        {invitingId === fan.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserPlus size={12} />
                        )}
                        Convidar
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClubInviteModal;
