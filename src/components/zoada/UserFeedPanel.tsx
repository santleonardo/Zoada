'use client';

import React, { useEffect, useState } from 'react';
import { Newspaper, ChevronDown } from 'lucide-react';
import { fetchUserPosts } from '@/lib/api';
import type { Post } from '@/types';
import PostCard from './PostCard';
import PostComposer from './PostComposer';

interface UserFeedPanelProps {
  /** Dono do feed que está sendo exibido (pode ser o próprio usuário logado ou outro). */
  userId: string;
  /** Se true, mostra as postagens como as "suas", com composer e opção de apagar. */
  isSelf: boolean;
}

/**
 * Feed do perfil: postagens (músicas compartilhadas e/ou textos livres)
 * que a pessoa fez publicamente — aparecem pra qualquer visitante do
 * perfil. Usado tanto no próprio perfil (com composer + opção de apagar)
 * quanto no perfil público de outra pessoa (só leitura).
 */
const UserFeedPanel: React.FC<UserFeedPanelProps> = ({ userId, isSelf }) => {
  // No próprio perfil já mostra aberto (é o conteúdo que a pessoa acabou
  // de criar); no perfil de outra pessoa fica fechado por padrão, igual
  // às outras seções dessa tela.
  const [isOpen, setIsOpen] = useState(isSelf);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [userId]);

  const handlePosted = (post: Post) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handleDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
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
            <>
              <p className="text-black/40 text-sm mb-3">
                Poste qualquer coisa aqui embaixo, ou uma música pelo menu de compartilhar do player.
              </p>
              <PostComposer onPosted={handlePosted} />
            </>
          )}

          {loading ? (
            <p className="text-xs text-black/40">Carregando...</p>
          ) : posts.length === 0 ? (
            <div className="rounded-xl bg-black/[0.03] p-6 text-center">
              <Newspaper size={32} className="text-black/15 mx-auto mb-2" />
              <p className="text-black/40 text-sm">
                {isSelf ? 'Você ainda não postou nada no feed' : 'Essa pessoa ainda não postou nada no feed'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} isOwner={isSelf} onDeleted={handleDeleted} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserFeedPanel;
