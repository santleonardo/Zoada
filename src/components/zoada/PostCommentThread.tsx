'use client';

import React, { useEffect, useState } from 'react';
import { MessageCircle, Send, Loader2, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { fetchPostComments, postPostComment, deletePostComment, togglePostCommentLike } from '@/lib/api';
import type { PostComment } from '@/types';
import { cn } from '@/lib/utils';
import ReactionHeart from './ReactionHeart';

interface PostCommentThreadProps {
  postId: string;
  /** Contagem vinda do próprio post (evita começar em "0 comentários" piscando enquanto carrega). */
  initialCount?: number;
}

/**
 * Thread de comentários de uma postagem do feed — botão com contador que
 * expande a lista (em ordem cronológica) e um campo pra comentar, igual ao
 * padrão de comentários de faixa no player, só que mais compacto pra caber
 * dentro do cartão de postagem.
 */
const PostCommentThread: React.FC<PostCommentThreadProps> = ({ postId, initialCount = 0 }) => {
  const user = useAppStore((state) => state.user);
  const selectUser = useAppStore((state) => state.selectUser);

  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [count, setCount] = useState(initialCount);
  const [newComment, setNewComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  // ID do comentário com o "apagar?" aberto (só um por vez) + ID em processo de apagar.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // IDs de comentários com uma reação em voo, pra evitar clique duplo.
  const [reactingIds, setReactingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || loaded) return;
    let cancelled = false;
    setLoading(true);
    fetchPostComments(postId).then((data) => {
      if (cancelled) return;
      setComments(data);
      setCount(data.length);
      setLoaded(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, loaded, postId]);

  const handleSend = async () => {
    const content = newComment.trim();
    if (!content || isSending) return;
    if (!user) {
      toast.error('Entre na sua conta para comentar');
      return;
    }

    setNewComment('');
    setIsSending(true);
    const result = await postPostComment(postId, content);
    setIsSending(false);

    if (!result) {
      setNewComment(content);
      toast.error('Não foi possível enviar o comentário. Tente novamente.');
      return;
    }

    setComments((prev) => [...prev, result]);
    setCount((prev) => prev + 1);
  };

  const handleReact = async (commentId: string) => {
    if (!user) {
      toast.error('Entre na sua conta para reagir');
      return;
    }
    if (reactingIds.has(commentId)) return;

    // Atualização otimista: já vira o coração e ajusta o contador na hora,
    // sem esperar a resposta do servidor.
    const previous = comments.find((c) => c.id === commentId);
    const wasLiked = !!previous?.liked_by_me;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              liked_by_me: !wasLiked,
              likes_count: Math.max(0, (c.likes_count || 0) + (wasLiked ? -1 : 1)),
            }
          : c
      )
    );
    setReactingIds((prev) => new Set(prev).add(commentId));

    const result = await togglePostCommentLike(commentId);

    setReactingIds((prev) => {
      const next = new Set(prev);
      next.delete(commentId);
      return next;
    });

    if (!result) {
      // Falhou: desfaz a atualização otimista.
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, liked_by_me: wasLiked, likes_count: previous?.likes_count || 0 } : c))
      );
      toast.error('Não foi possível reagir. Tente novamente.');
      return;
    }

    // Sincroniza com o valor real do servidor (fonte da verdade).
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, liked_by_me: result.liked, likes_count: result.likes_count } : c))
    );
  };

  const handleDeleteComment = async (commentId: string) => {
    setDeletingId(commentId);
    const ok = await deletePostComment(commentId);
    setDeletingId(null);
    setConfirmDeleteId(null);

    if (!ok) {
      toast.error('Não foi possível apagar o comentário. Tente novamente.');
      return;
    }

    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setCount((prev) => Math.max(0, prev - 1));
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-black/40 hover:text-[#6C5CE7] transition-colors mt-1.5 px-0.5"
        aria-expanded={isOpen}
      >
        <MessageCircle size={14} />
        <span className="text-xs font-medium">
          {count > 0 ? `${count} coment${count === 1 ? 'ário' : 'ários'}` : 'Comentar'}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 pt-2.5 border-t border-black/[0.06]">
          <div className="space-y-2.5 mb-2.5 max-h-40 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-3">
                <Loader2 size={14} className="text-black/30 animate-spin" />
              </div>
            )}

            {!loading && loaded && comments.length === 0 && (
              <p className="text-center text-black/30 text-xs py-2">
                Nenhum comentário ainda. Seja o primeiro!
              </p>
            )}

            {comments.map((comment) => {
              const isMe = comment.user?.id === user?.id;
              const canOpenProfile = !!comment.user?.id && !isMe;
              const handleGoToUser = () => {
                if (!canOpenProfile || !comment.user) return;
                selectUser(comment.user.id);
              };
              return (
                <div key={comment.id} className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleGoToUser}
                    disabled={!canOpenProfile}
                    className={cn(
                      'w-6 h-6 rounded-full bg-[#EFF0F6] flex items-center justify-center flex-shrink-0 overflow-hidden',
                      canOpenProfile && 'hover:ring-2 hover:ring-[#FF8C42] transition-shadow'
                    )}
                    aria-label={canOpenProfile ? `Ver perfil de ${comment.user?.name}` : undefined}
                  >
                    {comment.user?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={comment.user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-black/50">
                        {comment.user?.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <button
                        type="button"
                        onClick={handleGoToUser}
                        disabled={!canOpenProfile}
                        className={cn(
                          'text-xs font-semibold text-[#1A1B25] text-left',
                          canOpenProfile && 'hover:text-[#FF8C42] hover:underline transition-colors'
                        )}
                      >
                        {comment.user?.name || 'Anônimo'}
                      </button>
                      <span className="text-[10px] text-black/30">
                        {new Date(comment.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-xs text-black/60 mt-0.5 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleReact(comment.id)}
                      className={cn(
                        'flex items-center gap-1 mt-1 -ml-0.5 px-1 py-0.5 rounded-full transition-transform active:scale-90',
                        comment.liked_by_me ? 'text-[#E84393]' : 'text-black/30 hover:text-[#E84393]'
                      )}
                      aria-label={comment.liked_by_me ? 'Remover reação' : 'Reagir com coração'}
                      aria-pressed={!!comment.liked_by_me}
                    >
                      <ReactionHeart id={comment.id} active={!!comment.liked_by_me} />
                      {(comment.likes_count || 0) > 0 && (
                        <span className="text-[10px] font-medium">{comment.likes_count}</span>
                      )}
                    </button>
                  </div>

                  {isMe && (
                    <div className="flex items-center flex-shrink-0">
                      {deletingId === comment.id ? (
                        <Loader2 size={12} className="text-black/30 animate-spin" />
                      ) : confirmDeleteId === comment.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            aria-label="Confirmar exclusão"
                            className="p-1 rounded-full bg-[#E84393]/20 text-[#E84393] hover:bg-[#E84393]/30"
                          >
                            <Check size={11} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            aria-label="Cancelar"
                            className="p-1 rounded-full bg-black/5 text-black/50 hover:bg-black/10"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(comment.id)}
                          aria-label="Apagar comentário"
                          className="p-1 rounded-full text-black/20 hover:text-[#E84393] hover:bg-[#E84393]/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {user && (
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Adicionar comentário..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="!py-2 !text-xs"
              />
              <button
                onClick={handleSend}
                disabled={isSending || !newComment.trim()}
                className="p-2 rounded-xl gradient-bg flex-shrink-0 active:scale-90 transition-transform disabled:opacity-40"
                aria-label="Enviar comentário"
              >
                {isSending ? (
                  <Loader2 size={14} className="text-white animate-spin" />
                ) : (
                  <Send size={14} className="text-white" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostCommentThread;
