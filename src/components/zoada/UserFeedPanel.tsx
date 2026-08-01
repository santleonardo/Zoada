'use client';

import React, { useEffect, useState } from 'react';
import { Newspaper, ChevronDown, Play, Trash2, Check, X, Loader2 } from 'lucide-react';
import { fetchUserPosts, deletePost } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import type { Post } from '@/types';
import CoverArt from './CoverArt';

interface UserFeedPanelProps {
  /** Dono do feed que está sendo exibido (pode ser o próprio usuário logado ou outro). */
  userId: string;
  /** Se true, mostra as postagens como as "suas", com opção de apagar. */
  isSelf: boolean;
  /** Muda toda vez que uma postagem nova é criada, pra essa lista se atualizar sozinha. */
  refreshKey?: number;
}

/**
 * Feed de músicas postadas no perfil: cada postagem é uma faixa que a
 * pessoa escolheu compartilhar publicamente, com legenda opcional — como
 * um "repost" que aparece pra qualquer visitante do perfil. Usado tanto
 * no próprio perfil (com opção de apagar) quanto no perfil público de
 * outra pessoa (só leitura).
 */
const UserFeedPanel: React.FC<UserFeedPanelProps> = ({ userId, isSelf, refreshKey }) => {
  const playTrack = useAppStore((state) => state.playTrack);
  // No próprio perfil já mostra aberto (é o conteúdo que a pessoa acabou
  // de criar); no perfil de outra pessoa fica fechado por padrão, igual
  // às outras seções dessa tela.
  const [isOpen, setIsOpen] = useState(isSelf);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUserPosts(userId).then((data) => {
      if (!cancelled) {
        setPosts(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  const handleDelete = async (postId: string) => {
    setDeletingId(postId);
    const ok = await deletePost(postId);
    if (ok) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  return (
    <div className="rounded-2xl bg-white shadow-sm p-5 mb-6">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex items-center justify-between w-full mb-1"
      >
        <div className="flex items-center gap-2">
          <Newspaper size={18} className="text-[#6C5CE7]" />
          <h3 className="text-lg font-semibold text-[#1A1B25]">
            {isSelf ? 'Seu Feed' : 'Feed'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!loading && <span className="text-sm text-black/40">{posts.length} postagens</span>}
          <ChevronDown
            size={18}
            className={`text-black/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <>
          {isSelf && (
            <p className="text-black/40 text-sm mb-4">
              Músicas que você postou no seu perfil. Poste uma nova pelo menu de compartilhar,
              tocando uma música e escolhendo &quot;Postar no feed&quot;.
            </p>
          )}

          {loading ? (
            <p className="text-xs text-black/40">Carregando...</p>
          ) : posts.length === 0 ? (
            <div className="rounded-xl bg-black/[0.03] p-6 text-center">
              <Newspaper size={32} className="text-black/15 mx-auto mb-2" />
              <p className="text-black/40 text-sm">
                {isSelf ? 'Você ainda não postou nenhuma música no feed' : 'Essa pessoa ainda não postou nada no feed'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => {
                if (!post.track) return null;
                const track = post.track;

                return (
                  <div key={post.id} className="rounded-xl bg-[#F7F7FB] p-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => playTrack(track)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left group"
                      >
                        <div className="relative flex-shrink-0">
                          <CoverArt
                            title={track.title}
                            artistName={track.artist_name}
                            coverUrl={track.cover_url}
                            size="sm"
                            className="!w-12 !h-12 !max-w-none !rounded-lg"
                          />
                          <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <Play
                              size={16}
                              className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              fill="white"
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1A1B25] truncate">{track.title}</p>
                          <p className="text-xs text-black/40 truncate">{track.artist_name}</p>
                        </div>
                      </button>

                      {isSelf && (
                        confirmDeleteId === post.id ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {deletingId === post.id ? (
                              <Loader2 size={16} className="text-[#FF8C42] animate-spin" />
                            ) : (
                              <>
                                <span className="text-[11px] text-black/40 mr-1">Apagar?</span>
                                <button
                                  onClick={() => handleDelete(post.id)}
                                  aria-label="Confirmar exclusão"
                                  className="p-1 rounded-full bg-[#E84393]/20 text-[#E84393] hover:bg-[#E84393]/30"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  aria-label="Cancelar"
                                  className="p-1 rounded-full bg-black/5 text-black/50 hover:bg-black/10"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(post.id)}
                            aria-label={`Apagar postagem de "${track.title}"`}
                            className="p-1.5 rounded-full text-black/30 hover:text-[#E84393] hover:bg-[#E84393]/10 flex-shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        )
                      )}
                    </div>

                    {post.caption && (
                      <p className="text-sm text-black/60 mt-2.5 px-0.5">{post.caption}</p>
                    )}

                    <p className="text-[11px] text-black/30 mt-1.5 px-0.5">
                      {new Date(post.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserFeedPanel;
