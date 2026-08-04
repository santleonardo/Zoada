'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, Users, Lock } from 'lucide-react';
import { fetchUserFollowers, fetchUserFollowing, type FollowListItem } from '@/lib/api';

interface FollowListDialogProps {
  open: boolean;
  onClose: () => void;
  /** ID do usuário dono da lista (o perfil que está sendo visto). */
  userId: string;
  /** Aba inicial ao abrir. */
  initialTab: 'followers' | 'following';
  /** Chamado ao tocar em alguém da lista — normalmente abre o perfil dela. */
  onSelectUser: (userId: string) => void;
}

// Modal com abas "Seguidores" / "Seguindo" pra um usuário — aberto a partir
// dos contadores que já apareciam no perfil (próprio ou de outra pessoa),
// que até aqui só mostravam o número sem dar acesso à lista de verdade.
const FollowListDialog: React.FC<FollowListDialogProps> = ({
  open,
  onClose,
  userId,
  initialTab,
  onSelectUser,
}) => {
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab);
  const [followers, setFollowers] = useState<FollowListItem[] | null>(null);
  const [following, setFollowing] = useState<FollowListItem[] | null>(null);
  const [followersHidden, setFollowersHidden] = useState(false);
  const [followingHidden, setFollowingHidden] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reabre sempre na aba pedida (ex: clicou em "Seguidores" de novo depois
  // de ter fechado na aba "Seguindo").
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  // Busca a aba ativa sob demanda — só carrega "Seguindo" se o usuário de
  // fato clicar nela, evitando duas chamadas quando só uma lista é vista.
  useEffect(() => {
    if (!open || !userId) return;
    const alreadyLoaded = tab === 'followers' ? followers !== null : following !== null;
    if (alreadyLoaded) return;

    setLoading(true);
    const request = tab === 'followers' ? fetchUserFollowers(userId) : fetchUserFollowing(userId);
    request
      .then((result) => {
        if (tab === 'followers') {
          setFollowers(result.items);
          setFollowersHidden(result.hidden);
        } else {
          setFollowing(result.items);
          setFollowingHidden(result.hidden);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId, tab]);

  // Zera o cache ao trocar de perfil (senão reabrir em outro usuário
  // mostraria a lista da pessoa anterior por um instante).
  useEffect(() => {
    setFollowers(null);
    setFollowing(null);
    setFollowersHidden(false);
    setFollowingHidden(false);
  }, [userId]);

  if (!open) return null;

  const list = tab === 'followers' ? followers : following;
  const hidden = tab === 'followers' ? followersHidden : followingHidden;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-[#F7F7FB] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-black/5 sticky top-0 bg-[#F7F7FB] z-10">
          <div className="flex bg-black/5 rounded-full p-1">
            <button
              type="button"
              onClick={() => setTab('followers')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === 'followers' ? 'bg-white shadow-sm text-[#1A1B25]' : 'text-black/40'
              }`}
            >
              Seguidores
            </button>
            <button
              type="button"
              onClick={() => setTab('following')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === 'following' ? 'bg-white shadow-sm text-[#1A1B25]' : 'text-black/40'
              }`}
            >
              Seguindo
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Fechar"
          >
            <X size={16} className="text-black/50" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-10 text-black/30">
              <Loader2 size={22} className="animate-spin" />
            </div>
          )}

          {!loading && hidden && (
            <div className="text-center py-10">
              <Lock size={32} className="text-black/15 mx-auto mb-2" />
              <p className="text-sm text-black/40 max-w-[220px] mx-auto">
                {tab === 'followers'
                  ? 'Essa pessoa optou por ocultar quem a segue.'
                  : 'Essa pessoa optou por ocultar quem ela segue.'}
              </p>
            </div>
          )}

          {!loading && !hidden && list?.length === 0 && (
            <div className="text-center py-10">
              <Users size={32} className="text-black/15 mx-auto mb-2" />
              <p className="text-sm text-black/40">
                {tab === 'followers' ? 'Ninguém segue esse perfil ainda.' : 'Ainda não segue ninguém.'}
              </p>
            </div>
          )}

          {!loading &&
            !hidden &&
            list?.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onClose();
                  onSelectUser(u.id);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm text-left hover:bg-black/[0.02] transition-colors"
              >
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
                  {u.bio && <p className="text-xs text-black/40 truncate">{u.bio}</p>}
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default FollowListDialog;
