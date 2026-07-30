import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured, isR2Configured } from '@/lib/config';
import { deleteFromR2, keyFromPublicUrl } from '@/lib/r2';
import { DEMO_ARTISTS } from '@/lib/demo-data';

function serializeArtista(a: {
  id: string;
  usuarioId: string | null;
  nome: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string;
  genero: string;
  seguidoresCount: number;
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
        where: { usuarioId: userId },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ artists: artistas.map(serializeArtista) });
    }

    const artistas = await db.artista.findMany({
      orderBy: { seguidoresCount: 'desc' },
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
export async function PATCH(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, nome, avatarUrl, coverUrl, bio, genero } = await request.json();

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

// DELETE /api/artists?id=xxx — Apaga um artista inteiro (autenticado, só o
// dono). Isso remove também todas as faixas desse artista (a relação no
// Prisma tem onDelete: Cascade), e as faixas cascateiam para curtidas e
// comentários — então apagar um artista limpa todo o catálogo dele de uma
// vez. Apagar os arquivos no R2 (avatar, capa e os áudios/capas de cada
// faixa) é best-effort, igual à rota de faixas: se falhar, não desfazemos
// a exclusão, só avisamos no log.
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

    const artista = await db.artista.findUnique({
      where: { id },
      include: { faixas: true },
    });
    if (!artista) {
      return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 });
    }
    if (artista.usuarioId && artista.usuarioId !== userId) {
      return NextResponse.json({ error: 'Você não tem permissão para apagar esse artista' }, { status: 403 });
    }

    // Apaga a linha do banco primeiro (o que faz o artista e as músicas
    // dele sumirem do app de fato); a limpeza dos arquivos no R2 vem
    // depois, sem bloquear a exclusão caso algo falhe lá.
    await db.artista.delete({ where: { id } });

    if (isR2Configured) {
      const keys = [
        artista.avatarUrl ? keyFromPublicUrl(artista.avatarUrl) : null,
        artista.coverUrl ? keyFromPublicUrl(artista.coverUrl) : null,
        ...artista.faixas.flatMap((f) => [
          f.audioUrl ? keyFromPublicUrl(f.audioUrl) : null,
          f.coverUrl ? keyFromPublicUrl(f.coverUrl) : null,
        ]),
      ].filter((k): k is string => !!k);

      await Promise.all(
        keys.map((key) =>
          deleteFromR2(key).catch((err) => console.warn('[ARTISTS DELETE] falha ao apagar arquivo no R2:', err))
        )
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[ARTISTS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar artista' }, { status: 500 });
  }
}
