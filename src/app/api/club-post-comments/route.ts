import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { notDeleted } from '@/lib/soft-delete';
import type { ClubPostComment } from '@/types';

// Duração máxima aceita pra um comentário de voz — mesmo limite aplicado
// no cliente por useVoiceRecorder (maxSeconds), reforçado aqui pra não
// confiar só no front.
const MAX_AUDIO_SECONDS = 60;

// Confere se o usuário é membro do clube dono da postagem informada.
// Retorna null se a postagem não existir, ou o clubeId caso exista.
async function getClubIdIfMember(clubPostId: string, userId: string): Promise<string | null> {
  const postagem = await db.postagemClube.findUnique({
    where: { id: clubPostId },
    select: { clubeId: true },
  });
  if (!postagem) return null;

  const souMembro = await db.membroClube.findUnique({
    where: { clubeId_usuarioId: { clubeId: postagem.clubeId, usuarioId: userId } },
  });
  return souMembro ? postagem.clubeId : null;
}

// GET /api/club-post-comments?club_post_id=xxx — thread de comentários de
// uma postagem do mural de um clube. Só membros do clube podem ver
// (mesma restrição do mural em si, ver /api/clubs/posts).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubPostId = searchParams.get('club_post_id');

    if (!clubPostId) {
      return NextResponse.json({ error: 'club_post_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ comments: [] });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const clubeId = await getClubIdIfMember(clubPostId, userId);
    if (!clubeId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const comentarios = await db.comentarioPostagemClube.findMany({
      where: { postagemClubeId: clubPostId, ...notDeleted },
      include: {
        usuario: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { curtidas: true } },
        curtidas: { where: { usuarioId: userId }, select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const comments: ClubPostComment[] = comentarios.map((c) => ({
      id: c.id,
      user_id: c.usuarioId,
      club_post_id: c.postagemClubeId,
      content: c.conteudo,
      created_at: c.createdAt.toISOString(),
      user: {
        id: c.usuario.id,
        name: c.usuario.name,
        avatar_url: c.usuario.avatarUrl,
      },
      audio_url: c.audioUrl,
      audio_duration: c.audioDuracao,
      likes_count: c._count.curtidas,
      liked_by_me: c.curtidas.length > 0,
    }));

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('[CLUB POST COMMENTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar comentários da postagem do clube' }, { status: 500 });
  }
}

// POST /api/club-post-comments — Adiciona um comentário numa postagem do
// mural de um clube. Só membros do clube podem comentar.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { club_post_id, content, audio_url, audio_duration } = await request.json();
    const trimmed = typeof content === 'string' ? content.trim().slice(0, 500) : '';
    const audioUrl = typeof audio_url === 'string' && audio_url.trim() ? audio_url.trim() : null;
    const audioDuracao = audioUrl && Number.isFinite(audio_duration)
      ? Math.max(0, Math.min(MAX_AUDIO_SECONDS, Math.round(audio_duration)))
      : null;

    if (!club_post_id || (!trimmed && !audioUrl)) {
      return NextResponse.json({ error: 'club_post_id e um texto ou áudio são obrigatórios' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const clubeId = await getClubIdIfMember(club_post_id, userId);
    if (!clubeId) {
      return NextResponse.json({ error: 'Só membros do clube podem comentar' }, { status: 403 });
    }

    const comentario = await db.comentarioPostagemClube.create({
      data: {
        usuarioId: userId,
        postagemClubeId: club_post_id,
        conteudo: trimmed || '🎤 Comentário de voz',
        audioUrl,
        audioDuracao,
      },
      include: {
        usuario: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const comment: ClubPostComment = {
      id: comentario.id,
      user_id: comentario.usuarioId,
      club_post_id: comentario.postagemClubeId,
      content: comentario.conteudo,
      created_at: comentario.createdAt.toISOString(),
      user: {
        id: comentario.usuario.id,
        name: comentario.usuario.name,
        avatar_url: comentario.usuario.avatarUrl,
      },
      audio_url: comentario.audioUrl,
      audio_duration: comentario.audioDuracao,
      likes_count: 0,
      liked_by_me: false,
    };

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('[CLUB POST COMMENTS POST]', error);
    return NextResponse.json({ error: 'Erro ao comentar na postagem do clube' }, { status: 500 });
  }
}

// DELETE /api/club-post-comments?id=xxx — Soft-delete de um comentário
// próprio da thread. Some da thread na hora, mas fica 30 dias restaurável
// (PATCH abaixo) antes do job de limpeza apagar de vez.
export async function DELETE(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const comentario = await db.comentarioPostagemClube.findUnique({ where: { id } });
    if (!comentario) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }
    if (comentario.usuarioId !== userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    if (comentario.deletedAt) {
      return NextResponse.json({ error: 'Esse comentário já foi apagado' }, { status: 409 });
    }

    await db.comentarioPostagemClube.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ deleted: true, retention_days: 30 });
  } catch (error) {
    console.error('[CLUB POST COMMENTS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar comentário' }, { status: 500 });
  }
}

// PATCH /api/club-post-comments?id=xxx  body: { action: 'restore' } —
// Desfaz o soft-delete de um comentário dentro dos 30 dias (só o autor).
export async function PATCH(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { action } = await request.json().catch(() => ({ action: undefined }));
    if (action !== 'restore') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const comentario = await db.comentarioPostagemClube.findUnique({ where: { id } });
    if (!comentario) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }
    if (comentario.usuarioId !== userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    if (!comentario.deletedAt) {
      return NextResponse.json({ error: 'Esse comentário não está apagado' }, { status: 409 });
    }

    await db.comentarioPostagemClube.update({ where: { id }, data: { deletedAt: null } });
    return NextResponse.json({ restored: true });
  } catch (error) {
    console.error('[CLUB POST COMMENTS PATCH restore]', error);
    return NextResponse.json({ error: 'Erro ao restaurar comentário' }, { status: 500 });
  }
}
