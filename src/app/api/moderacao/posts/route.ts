import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  MODERATION_SECRET,
  isNeonConfigured,
  ZOADA_OFICIAL_EMAIL,
  ZOADA_OFICIAL_NOME,
  ZOADA_OFICIAL_AVATAR,
} from '@/lib/config';
import { notDeleted } from '@/lib/soft-delete';
import { isValidBearerSecret } from '@/lib/rateLimit';

// ============================================================
// /api/moderacao/posts — Canal do painel de moderação para publicar posts
// diretamente no feed geral do app (o mesmo feed mostrado na aba "Fãs" —
// ver GET /api/posts sem user_id). Todo post criado por aqui pertence a
// uma conta oficial fixa chamada "Zôada", com a logo do app como foto de
// perfil, criada/atualizada automaticamente (upsert) na primeira publicação.
//
// GET    — lista os posts já publicados pela conta oficial (pra moderação
//          gerenciar/apagar).
// POST   — publica um novo post no feed como "Zôada".
// DELETE — soft-delete de um post da conta oficial (mesmo padrão de
//          /api/posts, 30 dias pra restaurar antes da limpeza automática).
//
// Autenticação: `Authorization: Bearer <MODERATION_SECRET>`, igual ao
// resto do painel.
// ============================================================

function isModerator(request: Request): boolean {
  return isValidBearerSecret(request, MODERATION_SECRET);
}

// Garante que a conta oficial "Zôada" existe, sempre com o nome e a logo
// certos (upsert por email fixo — idempotente, não duplica).
async function ensureOfficialUser() {
  return db.usuario.upsert({
    where: { email: ZOADA_OFICIAL_EMAIL },
    update: { name: ZOADA_OFICIAL_NOME, avatarUrl: ZOADA_OFICIAL_AVATAR, deletedAt: null },
    create: {
      email: ZOADA_OFICIAL_EMAIL,
      name: ZOADA_OFICIAL_NOME,
      avatarUrl: ZOADA_OFICIAL_AVATAR,
    },
  });
}

// GET /api/moderacao/posts — últimos posts publicados pela conta oficial.
export async function GET(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ posts: [] });
    }

    const oficial = await db.usuario.findUnique({ where: { email: ZOADA_OFICIAL_EMAIL } });
    if (!oficial) {
      return NextResponse.json({ posts: [] });
    }

    const postagens = await db.postagem.findMany({
      where: { usuarioId: oficial.id, ...notDeleted },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        faixa: { include: { artista: { select: { nome: true } } } },
      },
    });

    return NextResponse.json({
      posts: postagens.map((p) => ({
        id: p.id,
        content: p.legenda,
        created_at: p.createdAt.toISOString(),
        track: p.faixa
          ? { id: p.faixa.id, title: p.faixa.titulo, artist_name: p.faixa.artista.nome }
          : null,
      })),
    });
  } catch (error) {
    console.error('[MODERACAO POSTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar postagens' }, { status: 500 });
  }
}

// POST /api/moderacao/posts  body: { content?, track_id? } — publica um
// post no feed geral como a conta oficial "Zôada". Precisa de pelo menos
// um dos dois, igual à criação normal de post em /api/posts.
export async function POST(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const trackId = typeof body.track_id === 'string' && body.track_id ? body.track_id : null;
    const content = typeof body.content === 'string' ? body.content.trim().slice(0, 280) : '';

    if (!trackId && !content) {
      return NextResponse.json(
        { error: 'A postagem precisa de uma música ou de um texto' },
        { status: 400 }
      );
    }

    if (trackId) {
      const faixaExiste = await db.faixa.findUnique({ where: { id: trackId }, select: { id: true } });
      if (!faixaExiste) {
        return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
      }
    }

    const oficial = await ensureOfficialUser();

    const postagem = await db.postagem.create({
      data: {
        usuarioId: oficial.id,
        faixaId: trackId,
        legenda: content || null,
      },
      include: {
        faixa: { include: { artista: { select: { nome: true } } } },
      },
    });

    return NextResponse.json(
      {
        post: {
          id: postagem.id,
          content: postagem.legenda,
          created_at: postagem.createdAt.toISOString(),
          track: postagem.faixa
            ? { id: postagem.faixa.id, title: postagem.faixa.titulo, artist_name: postagem.faixa.artista.nome }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[MODERACAO POSTS POST]', error);
    return NextResponse.json({ error: 'Erro ao postar' }, { status: 500 });
  }
}

// DELETE /api/moderacao/posts?id=xxx — soft-delete de um post da conta
// oficial (some do feed, mas fica 30 dias restaurável no banco).
export async function DELETE(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const oficial = await db.usuario.findUnique({ where: { email: ZOADA_OFICIAL_EMAIL } });
    const postagem = oficial ? await db.postagem.findUnique({ where: { id } }) : null;
    if (!postagem || postagem.usuarioId !== oficial?.id) {
      return NextResponse.json({ error: 'Postagem não encontrada' }, { status: 404 });
    }

    await db.postagem.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[MODERACAO POSTS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar postagem' }, { status: 500 });
  }
}
