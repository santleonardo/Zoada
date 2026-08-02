import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { DEMO_TRACKS } from '@/lib/demo-data';
import { notDeleted } from '@/lib/soft-delete';

// GET /api/tracks?artist_id=xxx  -> faixas de um artista específico (público)
// GET /api/tracks?mine=1         -> faixas de TODOS os artistas do usuário logado
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artist_id');
    const mine = searchParams.get('mine') === '1';

    if (!isNeonConfigured) {
      // Demo mode
      let tracks = DEMO_TRACKS;
      if (artistId) tracks = tracks.filter((t) => t.artist_id === artistId);
      if (mine) tracks = [];
      return NextResponse.json({ tracks });
    }

    let where: { artistaId?: string; artista?: { usuarioId: string } } = {};
    if (mine) {
      const userId = await authenticateRequest(request);
      if (!userId) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }
      where = { artista: { usuarioId: userId } };
    } else if (artistId) {
      where = { artistaId: artistId };
    }

    // Faixas apagadas (dentro da janela de 30 dias pra restaurar) não
    // aparecem em nenhuma listagem — inclusive na aba "minhas faixas", já
    // que essa passa a viver na Lixeira em vez daqui.
    const faixas = await db.faixa.findMany({
      where: { ...where, ...notDeleted },
      include: {
        artista: { select: { id: true, nome: true, avatarUrl: true } },
        // Contagens usadas no ranking "Mais tocadas" da Início, além de
        // plays_count: curtidas, favoritos, comentários, faixas enviadas em
        // conversas (compartilhamentos) e postagens no feed que citam essa
        // faixa. `_count` faz um COUNT agregado no banco, sem trazer os
        // registros inteiros.
        _count: {
          select: {
            curtidas: true,
            favoritos: true,
            comentarios: true,
            mensagens: true,
            postagens: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const tracks = faixas.map((f) => ({
      id: f.id,
      title: f.titulo,
      artist_id: f.artistaId,
      artist_name: f.artista.nome,
      // Se a faixa não tem capa própria, usa a foto do artista como fallback
      cover_url: f.coverUrl || f.artista.avatarUrl || null,
      audio_url: f.audioUrl,
      audio_url_low: f.audioUrlLow,
      duration: f.duracao,
      plays_count: f.playsCount,
      created_at: f.createdAt.toISOString(),
      likes_count: f._count.curtidas,
      favorites_count: f._count.favoritos,
      comments_count: f._count.comentarios,
      shares_count: f._count.mensagens,
      posts_count: f._count.postagens,
    }));

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error('[TRACKS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar faixas' }, { status: 500 });
  }
}

// POST /api/tracks — Create a new track (authenticated)
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { titulo, artistaId, coverUrl, audioUrl, audioUrlLow, duracao } = await request.json();

    if (!titulo || !artistaId) {
      return NextResponse.json({ error: 'titulo e artistaId são obrigatórios' }, { status: 400 });
    }

    // Verifica que o artista existe E que pertence a quem está enviando a
    // faixa — sem isso, um usuário autenticado poderia colar o id de
    // qualquer artista (inclusive de outra pessoa) e a faixa apareceria
    // como se fosse dela.
    const artista = await db.artista.findUnique({ where: { id: artistaId } });
    if (!artista) {
      return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 });
    }
    if (artista.usuarioId && artista.usuarioId !== userId) {
      return NextResponse.json({ error: 'Esse artista não pertence à sua conta' }, { status: 403 });
    }

    const faixa = await db.faixa.create({
      data: {
        titulo,
        artistaId,
        coverUrl: coverUrl || null,
        audioUrl: audioUrl || null,
        audioUrlLow: audioUrlLow || null,
        duracao: duracao || 0,
      },
      include: { artista: { select: { nome: true, avatarUrl: true } } },
    });

    return NextResponse.json({
      id: faixa.id,
      title: faixa.titulo,
      artist_id: faixa.artistaId,
      artist_name: faixa.artista.nome,
      cover_url: faixa.coverUrl || faixa.artista.avatarUrl || null,
      audio_url: faixa.audioUrl,
      audio_url_low: faixa.audioUrlLow,
      duration: faixa.duracao,
      plays_count: faixa.playsCount,
      created_at: faixa.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('[TRACKS POST]', error);
    return NextResponse.json({ error: 'Erro ao criar faixa' }, { status: 500 });
  }
}

// PATCH /api/tracks?id=xxx — Registra UMA reprodução, incrementando
// plays_count. Não exige login: quantas vezes uma faixa foi ouvida é uma
// métrica pública (como em qualquer serviço de streaming), não um dado do
// usuário. O client só chama isso depois que a faixa tocou de verdade por
// um tempo mínimo (ver audioEngine.ts), pra não contar cliques acidentais
// ou pulos rápidos entre músicas como reprodução.
//
// Além da contagem global, se a requisição vier autenticada, também
// incrementamos o contador pessoal (usuário+faixa) em "reproducoes" — é
// esse contador pessoal que alimenta a lista de "Mais ouvidas" no perfil.
// Sem login, essa parte simplesmente não roda (a contagem global continua
// normal), já que não há de quem guardar o hábito de escuta.
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      // Modo demo: não há banco pra persistir a contagem — responde OK
      // mesmo assim pra não gerar erros no player.
      return NextResponse.json({ plays_count: null });
    }

    const userId = await authenticateRequest(request);

    const faixa = await db.faixa.update({
      where: { id },
      data: { playsCount: { increment: 1 } },
      select: { playsCount: true },
    });

    if (userId) {
      // Best-effort: se essa parte falhar (ex: faixa apagada bem no meio
      // do caminho), a contagem global acima já foi salva, então só
      // registramos o erro sem derrubar a resposta.
      await db.reproducao
        .upsert({
          where: { usuarioId_faixaId: { usuarioId: userId, faixaId: id } },
          update: { vezes: { increment: 1 } },
          create: { usuarioId: userId, faixaId: id, vezes: 1 },
        })
        .catch((err) => console.warn('[TRACKS PATCH play] falha ao registrar reprodução pessoal:', err));
    }

    return NextResponse.json({ plays_count: faixa.playsCount });
  } catch (error) {
    // Provavelmente a faixa foi apagada entre o carregamento e o fim da
    // contagem (Prisma P2025) — não é grave, é só uma reprodução perdida.
    console.error('[TRACKS PATCH play]', error);
    return NextResponse.json({ error: 'Erro ao registrar reprodução' }, { status: 500 });
  }
}

// PUT /api/tracks?id=xxx — Edita as informações de uma faixa já publicada
// (título e/ou capa). Autenticado, só o dono do artista dono da faixa pode
// editar. Separado do PATCH de propósito: PATCH aqui já é usado para
// incrementar plays_count (chamado a toda hora, sem autenticação
// obrigatória) — misturar os dois nesse mesmo verbo ia exigir diferenciar
// "é edição ou é play?" dentro do handler, então PUT fica reservado só
// pra edição de metadados de verdade.
export async function PUT(request: Request) {
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

    const { titulo, coverUrl } = await request.json();

    const existing = await db.faixa.findUnique({ where: { id }, include: { artista: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
    }
    if (existing.artista.usuarioId && existing.artista.usuarioId !== userId) {
      return NextResponse.json({ error: 'Você não tem permissão para editar essa faixa' }, { status: 403 });
    }

    const faixa = await db.faixa.update({
      where: { id },
      data: {
        ...(titulo !== undefined ? { titulo } : {}),
        ...(coverUrl !== undefined ? { coverUrl } : {}),
      },
      include: { artista: { select: { nome: true, avatarUrl: true } } },
    });

    return NextResponse.json({
      id: faixa.id,
      title: faixa.titulo,
      artist_id: faixa.artistaId,
      artist_name: faixa.artista.nome,
      cover_url: faixa.coverUrl || faixa.artista.avatarUrl || null,
      audio_url: faixa.audioUrl,
      audio_url_low: faixa.audioUrlLow,
      duration: faixa.duracao,
      plays_count: faixa.playsCount,
      created_at: faixa.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[TRACKS PUT]', error);
    return NextResponse.json({ error: 'Erro ao editar faixa' }, { status: 500 });
  }
}

// DELETE /api/tracks?id=xxx — Soft-delete de uma faixa (autenticado, só o
// dono). Não apaga a linha nem os arquivos no R2 na hora: só marca
// `deletedAt`, o que já é suficiente pra faixa sumir de toda listagem
// (ver filtro `notDeleted` no GET acima). Fica 30 dias assim, restaurável
// pela Lixeira via PATCH abaixo — depois disso o job de limpeza
// (/api/cron/purge-deleted) apaga a linha de vez e os arquivos no R2.
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

    const faixa = await db.faixa.findUnique({ where: { id }, include: { artista: true } });
    if (!faixa) {
      return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
    }
    if (faixa.artista.usuarioId && faixa.artista.usuarioId !== userId) {
      return NextResponse.json({ error: 'Você não tem permissão para apagar essa faixa' }, { status: 403 });
    }
    if (faixa.deletedAt) {
      return NextResponse.json({ error: 'Essa faixa já foi apagada' }, { status: 409 });
    }

    await db.faixa.update({ where: { id }, data: { deletedAt: new Date() } });

    return NextResponse.json({ deleted: true, retention_days: 30 });
  } catch (error) {
    console.error('[TRACKS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar faixa' }, { status: 500 });
  }
}

// PATCH /api/tracks?id=xxx  body: { action: 'restore' } — Desfaz o
// soft-delete de uma faixa dentro dos 30 dias (autenticado, só o dono).
export async function PATCH(request: Request) {
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

    const { action } = await request.json().catch(() => ({ action: undefined }));
    if (action !== 'restore') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const faixa = await db.faixa.findUnique({ where: { id }, include: { artista: true } });
    if (!faixa) {
      return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
    }
    if (faixa.artista.usuarioId && faixa.artista.usuarioId !== userId) {
      return NextResponse.json({ error: 'Você não tem permissão para restaurar essa faixa' }, { status: 403 });
    }
    if (!faixa.deletedAt) {
      return NextResponse.json({ error: 'Essa faixa não está apagada' }, { status: 409 });
    }

    await db.faixa.update({ where: { id }, data: { deletedAt: null } });

    return NextResponse.json({ restored: true });
  } catch (error) {
    console.error('[TRACKS PATCH restore]', error);
    return NextResponse.json({ error: 'Erro ao restaurar faixa' }, { status: 500 });
  }
}
