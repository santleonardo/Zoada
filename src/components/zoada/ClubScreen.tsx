'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, Users, UserPlus, UserMinus, Send, MessageSquareText, Check, X, Loader2, ChevronDown, ChevronUp, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { fetchClubs, fetchClubMembers, fetchClubPosts, createClubPost, removeClubMember } from '@/lib/api';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import type { Club, ClubMember, ClubPost } from '@/types';
import CoverArt from './CoverArt';
import ClubInviteModal from './ClubInviteModal';
import VoiceMessageBubble from './VoiceMessageBubble';
import VoiceRecordingBar from './VoiceRecordingBar';

/**
 * Tela de um clube (comunidade de fãs): cabeçalho com nome/capa, campo de
 * postagens (mural, só pra membros) e botão de convidar membros (só pro
 * admin). Espelha a estrutura de ArtistProfileScreen/UserProfileScreen —
 * abre a partir de selectClub() e volta com goBack().
 */
const ClubScreen: React.FC = () => {
  const { selectedClubId, goBack, user } = useAppStore();

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isMember = !!club?.my_role;
  const isAdmin = club?.my_role === 'ADMIN';

  // Gravação de postagem de voz para o mural — mesmo mecanismo usado nas
  // conversas (ver ChatScreen), reaproveitado via useVoiceRecorder.
  const {
    voiceState,
    recordingSeconds,
    maxSeconds: maxRecordingSeconds,
    startRecording: handleStartRecording,
    cancelRecording: handleCancelRecording,
    stopAndSendRecording: handleStopAndSendRecording,
  } = useVoiceRecorder({
    resetKey: selectedClubId,
    disabled: !isMember,
    onRecorded: async (url, durationSeconds) => {
      if (!selectedClubId) return false;
      const post = await createClubPost(selectedClubId, '', { url, duration: durationSeconds });
      if (!post) return false;
      setPosts((prev) => [post, ...prev]);
      return true;
    },
  });

  useEffect(() => {
    if (!selectedClubId) return;
    let cancelled = false;
    setIsLoading(true);

    fetchClubs()
      .then((list) => {
        if (cancelled) return;
        setClub(list.find((c) => c.id === selectedClubId) || null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClubId]);

  // Mural e lista de membros só fazem sentido (e só a API deixa ver)
  // depois de saber que o usuário logado é membro do clube.
  useEffect(() => {
    if (!selectedClubId || !isMember) return;
    fetchClubMembers(selectedClubId).then(setMembers);
    fetchClubPosts(selectedClubId).then(setPosts);
  }, [selectedClubId, isMember]);

  const handlePost = async () => {
    const trimmed = content.trim();
    if (!trimmed || !selectedClubId || isPosting) return;

    setIsPosting(true);
    const post = await createClubPost(selectedClubId, trimmed);
    setIsPosting(false);

    if (!post) {
      toast.error('Não foi possível postar no clube. Tente novamente.');
      return;
    }

    setContent('');
    setPosts((prev) => [post, ...prev]);
  };

  const handleInvited = (member: ClubMember) => {
    setMembers((prev) => [...prev, member]);
    setClub((prev) => (prev ? { ...prev, members_count: prev.members_count + 1 } : prev));
    toast.success(`${member.name} agora faz parte do clube!`);
  };

  // Remove um membro (admin removendo outro fã) ou sai do clube (membro
  // removendo a si mesmo). A API já garante que o admin não consegue sair
  // do próprio clube, então esse botão nem aparece pra esse caso.
  const handleRemoveMember = async (targetUserId: string) => {
    if (!selectedClubId || removingId) return;
    const isSelf = targetUserId === user?.id;

    setRemovingId(targetUserId);
    const ok = await removeClubMember(selectedClubId, targetUserId);
    setRemovingId(null);
    setConfirmRemoveId(null);

    if (!ok) {
      toast.error(isSelf ? 'Não foi possível sair do clube.' : 'Não foi possível remover esse membro.');
      return;
    }

    setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId));
    setClub((prev) => (prev ? { ...prev, members_count: Math.max(0, prev.members_count - 1) } : prev));

    if (isSelf) {
      toast.success('Você saiu do clube.');
      goBack();
    } else {
      toast.success('Membro removido do clube.');
    }
  };

  if (!selectedClubId) return null;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={goBack}
          className="p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={22} className="text-[#1A1B25]" />
        </button>
        <h1 className="text-xl font-bold text-[#1A1B25] truncate flex-1">Clube</h1>
        {isAdmin && (
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full gradient-bg text-white text-xs font-semibold active:scale-95 transition-all"
          >
            <UserPlus size={14} />
            Convidar
          </button>
        )}
      </div>

      {isLoading && <p className="text-center text-black/40 text-sm py-12">Carregando clube...</p>}

      {!isLoading && !club && (
        <div className="text-center py-16">
          <p className="text-black/50">Clube não encontrado.</p>
        </div>
      )}

      {!isLoading && club && (
        <>
          {/* Club card */}
          <div className="rounded-2xl bg-white shadow-sm p-6 mb-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div
                className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle, #FF8C42, transparent)' }}
              />
              <div
                className="absolute bottom-0 left-0 w-40 h-40 rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle, #6C5CE7, transparent)' }}
              />
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <CoverArt
                title={club.name}
                artistName=""
                coverUrl={club.cover_url || ''}
                size="sm"
                className="!w-24 !h-24 !max-w-none !rounded-full mb-4"
              />
              <h2 className="text-xl font-bold text-[#1A1B25]">{club.name}</h2>
              {club.description && (
                <p className="text-sm text-black/40 mt-1 mb-1 max-w-xs">{club.description}</p>
              )}
              <p className="text-xs text-black/40 flex items-center gap-1 mt-2">
                <Users size={12} />
                {club.members_count} membro{club.members_count !== 1 ? 's' : ''}
                {club.my_role === 'ADMIN' ? ' · você é admin' : club.my_role === 'MEMBRO' ? ' · você é membro' : ''}
              </p>
            </div>
          </div>

          {!isMember && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <Users size={28} className="text-black/20" />
              </div>
              <p className="text-black/40 text-sm font-medium">
                Só quem é membro vê o mural. Peça pra alguém do clube te convidar.
              </p>
            </div>
          )}

          {isMember && (
            <>
              {/* Membros: lista recolhível, com opção de remover (admin) ou
                  sair (qualquer membro, exceto o admin). */}
              <div className="mb-4">
                <button
                  onClick={() => setShowMembers((v) => !v)}
                  className="w-full flex items-center justify-between text-left mb-2"
                >
                  <span className="text-sm font-semibold text-[#1A1B25] flex items-center gap-1.5">
                    <Users size={14} />
                    Membros ({members.length})
                  </span>
                  {showMembers ? (
                    <ChevronUp size={16} className="text-black/40" />
                  ) : (
                    <ChevronDown size={16} className="text-black/40" />
                  )}
                </button>

                {showMembers && (
                  <div className="space-y-1.5">
                    {members.map((member) => {
                      const isSelf = member.user_id === user?.id;
                      const canRemove = isAdmin ? !isSelf : isSelf;

                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-white shadow-sm"
                        >
                          <CoverArt
                            title={member.name}
                            artistName=""
                            coverUrl={member.avatar_url || ''}
                            size="sm"
                            className="!w-9 !h-9 !max-w-none !rounded-full flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1A1B25] truncate">
                              {member.name}
                              {isSelf ? ' (você)' : ''}
                            </p>
                            <p className="text-xs text-black/40">
                              {member.role === 'ADMIN' ? 'Admin' : 'Membro'}
                            </p>
                          </div>

                          {canRemove &&
                            (removingId === member.user_id ? (
                              <Loader2 size={16} className="text-black/30 animate-spin flex-shrink-0" />
                            ) : confirmRemoveId === member.user_id ? (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  onClick={() => handleRemoveMember(member.user_id)}
                                  aria-label={isSelf ? 'Confirmar saída' : 'Confirmar remoção'}
                                  className="p-1.5 rounded-full bg-[#E84393]/20 text-[#E84393] hover:bg-[#E84393]/30"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  onClick={() => setConfirmRemoveId(null)}
                                  aria-label="Cancelar"
                                  className="p-1.5 rounded-full bg-black/5 text-black/50 hover:bg-black/10"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmRemoveId(member.user_id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/5 text-black/50 hover:bg-[#E84393]/10 hover:text-[#E84393] text-xs font-medium transition-colors flex-shrink-0"
                              >
                                <UserMinus size={12} />
                                {isSelf ? 'Sair' : 'Remover'}
                              </button>
                            ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Campo de postagens (mural do clube) */}
              <div className="rounded-xl bg-[#F7F7FB] p-3 mb-4">
                {voiceState === 'recording' ? (
                  <VoiceRecordingBar
                    seconds={recordingSeconds}
                    maxSeconds={maxRecordingSeconds}
                    onCancel={handleCancelRecording}
                    onSend={handleStopAndSendRecording}
                  />
                ) : (
                  <>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value.slice(0, 280))}
                      placeholder="Poste algo para o clube..."
                      rows={2}
                      disabled={isPosting}
                      className="w-full !py-2 !text-sm !bg-white resize-none"
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-black/30">{content.length}/280</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleStartRecording}
                          disabled={isPosting || voiceState === 'uploading'}
                          className="p-2 rounded-full bg-white shadow-sm active:scale-90 transition-all disabled:opacity-40"
                          aria-label="Gravar postagem de voz"
                          title="Gravar áudio"
                        >
                          {voiceState === 'uploading' ? (
                            <span className="block w-3.5 h-3.5 border-2 border-black/20 border-t-[#6C5CE7] rounded-full animate-spin" />
                          ) : (
                            <Mic size={16} className="text-[#6C5CE7]" />
                          )}
                        </button>
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
                  </>
                )}
              </div>

              {/* Mural */}
              {posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                    <MessageSquareText size={28} className="text-black/20" />
                  </div>
                  <p className="text-black/40 text-sm font-medium">Ninguém postou nada no clube ainda. Seja o primeiro!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {posts.map((post) => (
                    <div key={post.id} className="rounded-2xl bg-white shadow-sm p-3.5">
                      <div className="flex items-center gap-2.5 mb-2">
                        <CoverArt
                          title={post.user.name}
                          artistName=""
                          coverUrl={post.user.avatar_url || ''}
                          size="sm"
                          className="!w-8 !h-8 !max-w-none !rounded-full flex-shrink-0"
                        />
                        <span className="text-sm font-semibold text-[#1A1B25] truncate">{post.user.name}</span>
                      </div>
                      {post.audio_url ? (
                        <VoiceMessageBubble url={post.audio_url} duration={post.audio_duration} isMe={false} />
                      ) : (
                        <p className="text-sm text-black/70 whitespace-pre-wrap break-words">{post.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {club && (
        <ClubInviteModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          clubId={club.id}
          memberIds={members.map((m) => m.user_id)}
          onInvited={handleInvited}
        />
      )}
    </div>
  );
};

export default ClubScreen;
