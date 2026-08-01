'use client';

import React, { useState } from 'react';
import { Play, Trash2, Check, X, Loader2, Heart } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { deletePost, togglePostReaction } from '@/lib/api';
import type { Post } from '@/types';
import CoverArt from './CoverArt';

interface PostCardProps {
  post: Post;
  /** Mostra nome/avatar de quem postou (feed geral). No próprio perfil isso é redundante. */
  showAuthor?: boolean;
  /** Se true, mostra o botão de apagar (só o dono da postagem deve poder apagar). */
  isOwner?: boolean;
  /** Chamado depois que a postagem é apagada com sucesso, pra sumir da lista. */
  onDeleted?: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, showAuthor = false, isOwner = false, onDeleted }) => {
  const playTrack = useAppStore((state) => state.playTrack);
  const selectUser = useAppStore((state) => state.selectUser);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reacted, setReacted] = useState(post.reacted);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [reacting, setReacting] = useState(false);

  // Dá (ou tira) o coração na postagem — única reação disponível aqui,
  // sem cardápio de emojis. Atualiza a tela na hora (otimista) e desfaz
  // se a chamada ao servidor falhar (ex: sessão expirada).
  const handleToggleReaction = async () => {
    if (reacting) return;
    setReacting(true);
    const prevReacted = reacted;
    const prevCount = likesCount;
    setReacted(!prevReacted);
    setLikesCount(prevReacted ? prevCount - 1 : prevCount + 1);

    const result = await togglePostReaction(post.id);
    if (result === null) {
      setReacted(prevReacted);
      setLikesCount(prevCount);
    } else {
      setReacted(result.reacted);
      setLikesCount(result.likes_count);
    }
    setReacting(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const ok = await deletePost(post.id);
    setDeleting(false);
    if (ok) {
      onDeleted?.(post.id);
    }
    setConfirmDelete(false);
  };

  const authorName = post.user?.name || 'Alguém';
  const track = post.track;

  return (
    <div className="rounded-xl bg-[#F7F7FB] p-3">
      {showAuthor && (
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => post.user?.id && selectUser(post.user.id)}
            className="flex items-center gap-2 min-w-0 text-left group"
          >
            <div className="w-7 h-7 rounded-full bg-[#EFF0F6] overflow-hidden flex items-center justify-center flex-shrink-0">
              {post.user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.user.avatar_url} alt={authorName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[11px] font-bold text-black/50">{authorName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <span className="text-sm font-semibold text-[#1A1B25] truncate group-hover:text-[#FF8C42] group-hover:underline transition-colors">
              {authorName}
            </span>
          </button>

          {isOwner && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {deleting ? (
                  <Loader2 size={14} className="text-[#FF8C42] animate-spin" />
                ) : (
                  <>
                    <button
                      onClick={handleDelete}
                      aria-label="Confirmar exclusão"
                      className="p-1 rounded-full bg-[#E84393]/20 text-[#E84393] hover:bg-[#E84393]/30"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      aria-label="Cancelar"
                      className="p-1 rounded-full bg-black/5 text-black/50 hover:bg-black/10"
                    >
                      <X size={13} />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                aria-label="Apagar postagem"
                className="p-1.5 rounded-full text-black/30 hover:text-[#E84393] hover:bg-[#E84393]/10 flex-shrink-0"
              >
                <Trash2 size={15} />
              </button>
            )
          )}
        </div>
      )}

      {post.content && (
        <p className="text-sm text-black/70 whitespace-pre-wrap break-words px-0.5">{post.content}</p>
      )}

      {track && (
        <div className={post.content ? 'mt-2.5' : ''}>
          <button
            type="button"
            onClick={() => playTrack(track)}
            className="flex items-center gap-3 w-full text-left group"
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
        </div>
      )}

      {!showAuthor && isOwner && (
        <div className="flex items-center justify-end mt-1.5">
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              {deleting ? (
                <Loader2 size={14} className="text-[#FF8C42] animate-spin" />
              ) : (
                <>
                  <span className="text-[11px] text-black/40 mr-1">Apagar?</span>
                  <button
                    onClick={handleDelete}
                    aria-label="Confirmar exclusão"
                    className="p-1 rounded-full bg-[#E84393]/20 text-[#E84393] hover:bg-[#E84393]/30"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    aria-label="Cancelar"
                    className="p-1 rounded-full bg-black/5 text-black/50 hover:bg-black/10"
                  >
                    <X size={13} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="Apagar postagem"
              className="p-1.5 rounded-full text-black/30 hover:text-[#E84393] hover:bg-[#E84393]/10"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-1.5 px-0.5">
        <button
          type="button"
          onClick={handleToggleReaction}
          disabled={reacting}
          aria-label={reacted ? 'Remover reação de coração' : 'Reagir com coração'}
          className="flex items-center gap-1.5 py-1 pr-2 -ml-0.5 rounded-full active:scale-90 transition-transform disabled:opacity-60"
        >
          <svg width="0" height="0" className="absolute">
            <defs>
              <linearGradient id="zoadaPostHeartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF8C42" />
                <stop offset="50%" stopColor="#E84393" />
                <stop offset="100%" stopColor="#6C5CE7" />
              </linearGradient>
            </defs>
          </svg>
          <Heart
            size={16}
            fill={reacted ? 'url(#zoadaPostHeartGradient)' : 'none'}
            stroke={reacted ? 'none' : 'currentColor'}
            className={reacted ? '' : 'text-black/30'}
          />
          {likesCount > 0 && (
            <span className={reacted ? 'text-xs font-semibold text-[#E84393]' : 'text-xs text-black/40'}>
              {likesCount}
            </span>
          )}
        </button>

        <p className="text-[11px] text-black/30">
          {new Date(post.created_at).toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  );
};

export default PostCard;
