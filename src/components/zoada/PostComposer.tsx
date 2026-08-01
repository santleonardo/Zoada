'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { createPost } from '@/lib/api';
import type { Post } from '@/types';

interface PostComposerProps {
  /** Chamado com a postagem recém-criada, pra já aparecer no topo da lista. */
  onPosted: (post: Post) => void;
  placeholder?: string;
}

/**
 * Campo simples de "postar qualquer coisa": só um texto livre, sem
 * música anexada (pra isso já existe "Postar no feed" no player). Usado
 * no topo do próprio feed (perfil) e no feed geral da aba Fãs.
 */
const PostComposer: React.FC<PostComposerProps> = ({ onPosted, placeholder }) => {
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const handlePost = async () => {
    const trimmed = content.trim();
    if (!trimmed || isPosting) return;

    setIsPosting(true);
    const post = await createPost(null, trimmed);
    setIsPosting(false);

    if (!post) {
      toast.error('Não foi possível postar. Tente novamente.');
      return;
    }

    setContent('');
    onPosted(post);
  };

  return (
    <div className="rounded-xl bg-[#F7F7FB] p-3 mb-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, 280))}
        placeholder={placeholder || 'O que você tá ouvindo/pensando?'}
        rows={2}
        disabled={isPosting}
        className="w-full !py-2 !text-sm !bg-white resize-none"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-black/30">{content.length}/280</span>
        <button
          onClick={handlePost}
          disabled={!content.trim() || isPosting}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full gradient-bg text-white text-sm font-semibold active:scale-95 transition-all disabled:opacity-40"
        >
          {isPosting ? (
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={14} />
          )}
          Postar
        </button>
      </div>
    </div>
  );
};

export default PostComposer;
