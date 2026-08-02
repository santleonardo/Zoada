import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { daysLeftToRestore } from '@/lib/soft-delete';

// GET /api/trash — Lixeira: tudo que o usuário logado apagou (faixa,
// artista, postagem, comentário de postagem, estação de rádio) e ainda
// está dentro da janela de 30 dias pra restaurar. Cada item já vem com
// `days_left` calculado, pra UI mostrar "restaura por mais X dias".
export async function GET(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ tracks: [], artists: [], posts: [], comments: [], station: null });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const [faixas, artistas, postagens, comentarios, estacao] = await Promise.all([
      db.faixa.findMany({
        where: { artista: { usuarioId: userId }, deletedAt: { not: null } },
        include: { artista: { select: { id: true, nome: true, avatarUrl: true } } },
        orderBy: { deletedAt: 'desc' },
      }),
      db.artista.findMany({
        where: { usuarioId: userId, deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
      }),
      db.postagem.findMany({
        where: { usuarioId: userId, deletedAt: { not: null } },
        include: { faixa: { select: { id: true, titulo: true, coverUrl: true } } },
        orderBy: { deletedAt: 'desc' },
      }),
      db.comentarioPostagem.findMany({
        where: { usuarioId: userId, deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
      }),
      db.estacaoRadio.findFirst({
        where: { usuarioId: userId, deletedAt: { not: null } },
      }),
    ]);

    return NextResponse.json({
      tracks: faixas.map((f) => ({
        id: f.id,
        title: f.titulo,
        cover_url: f.coverUrl || f.artista.avatarUrl || null,
        artist_id: f.artistaId,
        artist_name: f.artista.nome,
        deleted_at: f.deletedAt!.toISOString(),
        days_left: daysLeftToRestore(f.deletedAt!),
      })),
      artists: artistas.map((a) => ({
        id: a.id,
        name: a.nome,
        avatar_url: a.avatarUrl,
        deleted_at: a.deletedAt!.toISOString(),
        days_left: daysLeftToRestore(a.deletedAt!),
      })),
      posts: postagens.map((p) => ({
        id: p.id,
        content: p.legenda,
        track_title: p.faixa?.titulo ?? null,
        cover_url: p.faixa?.coverUrl ?? null,
        deleted_at: p.deletedAt!.toISOString(),
        days_left: daysLeftToRestore(p.deletedAt!),
      })),
      comments: comentarios.map((c) => ({
        id: c.id,
        content: c.conteudo,
        post_id: c.postagemId,
        deleted_at: c.deletedAt!.toISOString(),
        days_left: daysLeftToRestore(c.deletedAt!),
      })),
      station: estacao
        ? {
            id: estacao.id,
            name: estacao.nome,
            cover_url: estacao.capaUrl,
            deleted_at: estacao.deletedAt!.toISOString(),
            days_left: daysLeftToRestore(estacao.deletedAt!),
          }
        : null,
    });
  } catch (error) {
    console.error('[TRASH GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar lixeira' }, { status: 500 });
  }
}
