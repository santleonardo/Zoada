import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { DEMO_ARTISTS } from '@/lib/demo-data';
import { notDeleted } from '@/lib/soft-delete';

function serializeArtista(a: {
  id: string;
  usuarioId: string | null;
  nome: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string;
  genero: string;
  seguidoresCount: number;
  usuario?: { name: string } | null;
}) {
  return {
    id: a.id,
    user_id: a.usuarioId,
    name: a.nome,
    avatar_url: a.avatarUrl,
    cover_url: a.coverUrl,
    bio: a.bio,
    genre: a.genero,
    followers_count: a.seguidoresCount,
    // Nome de verdade de quem fez o upload/criou esse perfil de artista —
    // é pra ELE que as mensagens vão de fato, já que "artista" aqui é só
    // uma espécie de playlist/persona criada por um usuário, não uma
    // pessoa própria com conta própria.
    owner_name: a.usuario?.name ?? null,
  };
}

// GET /api/artists            -> lista pública de todos os artistas
// GET /api/artists?mine=1     -> lista só dos artistas do usuário autenticado
// (uma conta pode ter vários artistas — ex: alguém populando o catálogo
// com diferentes artistas fictícios)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mine = searchParams.get('mine') === '1';

    if (!isNeonConfigured) {
      if (mine) return NextResponse.json({ artists: [] });
      return NextResponse.json({ artists: DEMO_ARTISTS });
    }

    if (mine) {
      const userId = await authenticateRequest(request);
      if (!userId) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }
      const artistas = await db.artista.findMany({
        where: { usuarioId: userId, ...notDeleted },
        orderBy: { createdAt: 'desc' },
        include: { usuario: { select: { name: true } } },
      });
      return NextResponse.json({ artists: artistas.map(serializeArtista) });
    }

    const artistas = await db.artista.findMany({
      where: { ...notDeleted },
      orderBy: { seguidoresCount: 'desc' },
      include: { usuario: { select: { name: true } } },
    });

    return NextResponse.json({ artists: artistas.map(serializeArtista) });
  } catch (error) {
    console.error('[ARTISTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar artistas' }, { status: 500 });
  }
}

// POST /api/artists — Cria um artista NOVO para o usuário autenticado.
//
// Importante: sempre cria — nunca reaproveita um artista existente por
// nome ou por ser "o único que você tem". É assim que dois artistas
// diferentes (ex: "Rick Tropical" e "Jamba Jô") permanecem separados
// mesmo sendo enviados pela mesma conta: cada um vira sua própria linha
// no banco, com seu próprio id, nome e foto. Editar um artista já criado
// é feito à parte, via PATCH passando o id dele.
export async function POST(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { nome, avatarUrl, coverUrl, bio, genero } = await request.json();

    if (!nome) {
      return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 });
    }

    const artista = await db.artista.create({
      data: {
        usuarioId: userId,
        nome,
        avatarUrl: avatarUrl || null,
        coverUrl: coverUrl || null,
        bio: bio || '',
        genero: genero || '',
      },
    });

    return NextResponse.json(serializeArtista(artista), { status: 201 });
  } catch (error) {
    console.error('[ARTISTS POST]', error);
    return NextResponse.json({ error: 'Erro ao criar artista' }, { status: 500 });
  }
}

// PATCH /api/artists — Atualiza o perfil de UM artista já existente (nome,
// bio, gênero, imagens). Só o dono (usuarioId) pode editar — sem essa
// checagem, editar o "Nome artístico" no formulário de upload podia
// reescrever qualquer artista cujo id estivesse em cache no navegador,
// mesmo que fosse de outra conta (ou de outro artista seu).
//
// PATCH /api/artists?id=xxx  body: { action: 'restore' } — Desfaz o
// soft-delete de um artista (e das faixas dele apagadas junto) dentro dos
// 30 dias (autenticado, só o dono). Diferenciado do caso de edição acima
// pelo campo "action" no corpo da requisição.
export async function PATCH(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id');
    const body = await request.json().catch(() => ({}));

    if (queryId && body.action === 'restore') {
      const id = queryId;

      const artista = await db.artista.findUnique({ where: { id } });
      if (!artista) {
        return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 });
      }
      if (artista.usuarioId && artista.usuarioId !== userId) {
        return NextResponse.json({ error: 'Você não tem permissão para restaurar esse artista' }, { status: 403 });
      }
      if (!artista.deletedAt) {
        return NextResponse.json({ error: 'Esse artista não está apagado' }, { status: 409 });
      }

      await db.$transaction([
        db.artista.update({ where: { id }, data: { deletedAt: null } }),
        db.faixa.updateMany({ where: { artistaId: id, deletedAt: artista.deletedAt }, data: { deletedAt: null } }),
      ]);

      return NextResponse.json({ restored: true });
    }

    const { id, nome, avatarUrl, coverUrl, bio, genero } = body;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const existing = await db.artista.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 });
    }
    if (existing.usuarioId !== userId) {
      return NextResponse.json({ error: 'Você não tem permissão para editar esse artista' }, { status: 403 });
    }

    const artista = await db.artista.update({
      where: { id },
      data: {
        ...(nome !== undefined ? { nome } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(coverUrl !== undefined ? { coverUrl } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(genero !== undefined ? { genero } : {}),
      },
    });

    return NextResponse.json(serializeArtista(artista));
  } catch (error) {
    console.error('[ARTISTS PATCH]', error);
    return NextResponse.json({ error: 'Erro ao atualizar artista' }, { status: 500 });
  }
}

// DELETE /api/artists?id=xxx — Soft-delete de um artista inteiro
// (autenticado, só o dono). Marca `deletedAt` no artista E em todas as
// faixas dele que ainda não estavam apagadas — assim o catálogo inteiro
// some das listagens de uma vez, igual ao comportamento antigo, mas
// reversível por 30 dias (ver PATCH abaixo). Nada é apagado do banco nem
// do R2 nessa hora; isso só acontece no job de limpeza depois do prazo.
export async function DELETE(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
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

    const artista = await db.artista.findUnique({ where: { id } });
    if (!artista) {
      return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 });
    }
    if (artista.usuarioId && artista.usuarioId !== userId) {
      return NextResponse.json({ error: 'Você não tem permissão para apagar esse artista' }, { status: 403 });
    }
    if (artista.deletedAt) {
      return NextResponse.json({ error: 'Esse artista já foi apagado' }, { status: 409 });
    }

    const now = new Date();
    await db.$transaction([
      db.artista.update({ where: { id }, data: { deletedAt: now } }),
      db.faixa.updateMany({ where: { artistaId: id, deletedAt: null }, data: { deletedAt: now } }),
    ]);

    return NextResponse.json({ deleted: true, retention_days: 30 });
  } catch (error) {
    console.error('[ARTISTS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar artista' }, { status: 500 });
  }
}


