import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import type { RadioStation, Track } from '@/types';

// Helpers para converter Prisma → tipo de resposta (snake_case)

function stationToResponse(estacao: any, includeOwner = false, includeTracks = false): RadioStation {
  const result: RadioStation = {
    id: estacao.id,
    user_id: estacao.usuarioId,
    name: estacao.nome,
    cover_url: estacao.capaUrl,
    bio: estacao.bio ?? null,
    is_published: estacao.publicada,
    current_track_id: estacao.faixaAtualId,
    current_track_started_at: estacao.faixaAtualInicio?.toISOString() ?? null,
    created_at: estacao.createdAt.toISOString(),
  };

  if (includeOwner && estacao.usuario) {
    result.owner = {
      id: estacao.usuario.id,
      name: estacao.usuario.name || '',
      avatar_url: estacao.usuario.avatarUrl,
    };
  }

  if (includeTracks && estacao.faixasEstacao) {
    // Ordena pelo campo `ordem` e converte cada faixa pro formato Track
    result.tracks = estacao.faixasEstacao
      .sort((a: any, b: any) => a.ordem - b.ordem)
      .map((fe: any) => {
        const faixa = fe.faixa;
        if (!faixa) return null;
        return {
          id: faixa.id,
          title: faixa.titulo,
          artist_id: faixa.artistaId,
          artist_name: faixa.artista?.nome || '',
          cover_url: faixa.coverUrl || '',
          audio_url: faixa.audioUrl || '',
          duration: faixa.duracao,
          plays_count: faixa.playsCount,
          created_at: faixa.createdAt.toISOString(),
        } as Track;
      })
      .filter(Boolean) as Track[];
  }

  return result;
}

// ============================================================
// GET /api/radio-station
// ?mine=1             → estação do usuário logado (autenticado)
// ?published=1        → lista todas as estações publicadas (público)
// ?station_id=xxx     → dados de uma estação específica com faixas (público)
// (sem query)          → retorna { stations: [] } vazio (não existe mais
//                       "estação global ativa")
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // --- Estação do próprio usuário ---
    if (searchParams.get('mine') === '1') {
      if (!isNeonConfigured) {
        return NextResponse.json({ station: null });
      }

      const userId = await authenticateRequest(request);
      if (!userId) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }

      const estacao = await db.estacaoRadio.findUnique({
        where: { usuarioId: userId },
        include: {
          faixasEstacao: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });

      if (!estacao) {
        return NextResponse.json({ station: null });
      }

      return NextResponse.json({ station: stationToResponse(estacao, false, true) });
    }

    // --- Lista todas as estações publicadas (público) ---
    if (searchParams.get('published') === '1') {
      if (!isNeonConfigured) {
        return NextResponse.json({ stations: [] });
      }

      const estacoes = await db.estacaoRadio.findMany({
        where: { publicada: true },
        include: {
          usuario: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        stations: estacoes.map((e) => stationToResponse(e, true, false)),
      });
    }

    // --- Dados de uma estação específica (com faixas, para tocar) ---
    const stationId = searchParams.get('station_id');
    if (stationId) {
      if (!isNeonConfigured) {
        return NextResponse.json({ station: null });
      }

      const estacao = await db.estacaoRadio.findUnique({
        where: { id: stationId },
        include: {
          usuario: { select: { id: true, name: true, avatarUrl: true } },
          faixasEstacao: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });

      if (!estacao || !estacao.publicada) {
        return NextResponse.json({ station: null });
      }

      return NextResponse.json({ station: stationToResponse(estacao, true, true) });
    }

    // Sem query params — não existe mais "estação global ativa"
    return NextResponse.json({ stations: [] });
  } catch (error) {
    console.error('[RADIO STATION GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar estações' }, { status: 500 });
  }
}

// ============================================================
// POST /api/radio-station
// Cria ou atualiza a estação do usuário logado (nome, capa, faixas).
// Se o usuário já tem uma estação, ela é atualizada (upsert).
// ============================================================
export async function POST(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, cover_url, bio, track_ids } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }

    // Bio é opcional, mas se vier, limita o tamanho pra evitar textos gigantes.
    const trimmedBio = typeof bio === 'string' ? bio.trim().slice(0, 280) : null;

    if (!Array.isArray(track_ids) || track_ids.length === 0) {
      return NextResponse.json({ error: 'track_ids deve ser um array não vazio' }, { status: 400 });
    }

    // Verifica se as faixas informadas realmente existem no catálogo.
    const existingTracks = await db.faixa.findMany({
      where: { id: { in: track_ids } },
      select: { id: true },
    });
    const validIds = new Set(existingTracks.map((t) => t.id));
    const validTrackIds = track_ids.filter((id: string) => validIds.has(id));

    if (validTrackIds.length === 0) {
      return NextResponse.json({ error: 'Nenhuma faixa válida informada' }, { status: 400 });
    }

    // Upsert: se já existe estação desse usuário, atualiza; senão, cria.
    const estacao = await db.estacaoRadio.upsert({
      where: { usuarioId: userId },
      create: {
        usuarioId: userId,
        nome: name.trim(),
        capaUrl: cover_url || null,
        bio: trimmedBio || null,
      },
      update: {
        nome: name.trim(),
        capaUrl: cover_url || null,
        bio: trimmedBio || null,
      },
      include: {
        faixasEstacao: {
          include: { faixa: { include: { artista: { select: { nome: true } } } } },
        },
      },
    });

    // Substitui a lista de faixas da estação pela nova lista ordenada.
    await db.faixaEstacao.deleteMany({ where: { estacaoId: estacao.id } });

    await db.faixaEstacao.createMany({
      data: validTrackIds.map((faixaId: string, index: number) => ({
        estacaoId: estacao.id,
        faixaId,
        ordem: index,
      })),
    });

    // Busca de novo pra devolver com as faixas já incluídas.
    const updated = await db.estacaoRadio.findUnique({
      where: { id: estacao.id },
      include: {
        faixasEstacao: {
          include: { faixa: { include: { artista: { select: { nome: true } } } } },
        },
      },
    });

    return NextResponse.json(
      { station: stationToResponse(updated!, false, true) },
      { status: 201 },
    );
  } catch (error) {
    console.error('[RADIO STATION POST]', error);
    return NextResponse.json({ error: 'Erro ao salvar estação' }, { status: 500 });
  }
}

// ============================================================
// PATCH /api/radio-station
// { "action": "publish" }   → publica a estação (disponível no seletor)
// { "action": "unpublish" } → remove do seletor (mas não apaga)
// { "action": "advance" }   → avança a faixa atual (quando uma termina)
// ============================================================
export async function PATCH(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const estacao = await db.estacaoRadio.findUnique({
      where: { usuarioId: userId },
      include: {
        faixasEstacao: {
          include: { faixa: { include: { artista: { select: { nome: true } } } } },
        },
      },
    });

    if (!estacao) {
      return NextResponse.json({ error: 'Estação não encontrada' }, { status: 404 });
    }

    if (action === 'publish') {
      // Publica a estação (disponível no seletor). NÃO despublica outras —
      // múltiplas estações podem coexistir publicadas.
      const faixasOrdenadas = estacao.faixasEstacao
        .filter((fe) => fe.faixa !== null)
        .sort((a, b) => a.ordem - b.ordem);

      const updated = await db.estacaoRadio.update({
        where: { id: estacao.id },
        data: {
          publicada: true,
          faixaAtualId: faixasOrdenadas.length > 0 ? faixasOrdenadas[0].faixaId : null,
          faixaAtualInicio: faixasOrdenadas.length > 0 ? new Date() : null,
        },
        include: {
          usuario: { select: { id: true, name: true, avatarUrl: true } },
          faixasEstacao: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });

      return NextResponse.json({ station: stationToResponse(updated, true, true) });
    }

    if (action === 'unpublish') {
      // Despublica a estação (sai do seletor). NÃO afeta outras estações.
      const updated = await db.estacaoRadio.update({
        where: { id: estacao.id },
        data: {
          publicada: false,
          faixaAtualId: null,
          faixaAtualInicio: null,
        },
      });

      return NextResponse.json({ station: stationToResponse(updated) });
    }

    if (action === 'advance') {
      // Avança para a próxima faixa da estação. Chamado pelo cliente quando
      // a faixa atual termina de tocar.
      if (!estacao.publicada || !estacao.faixaAtualId) {
        return NextResponse.json({ station: stationToResponse(estacao) });
      }

      const faixasOrdenadas = estacao.faixasEstacao
        .filter((fe) => fe.faixa !== null)
        .sort((a, b) => a.ordem - b.ordem);

      const currentIdx = faixasOrdenadas.findIndex(
        (fe) => fe.faixaId === estacao.faixaAtualId,
      );

      // Se estava na última, volta pra primeira (loop infinito).
      const nextIdx = (currentIdx + 1) % faixasOrdenadas.length;

      const updated = await db.estacaoRadio.update({
        where: { id: estacao.id },
        data: {
          faixaAtualId: faixasOrdenadas[nextIdx].faixaId,
          faixaAtualInicio: new Date(),
        },
      });

      return NextResponse.json({ station: stationToResponse(updated) });
    }

    return NextResponse.json({ error: 'Ação inválida. Use "publish", "unpublish" ou "advance".' }, { status: 400 });
  } catch (error) {
    console.error('[RADIO STATION PATCH]', error);
    return NextResponse.json({ error: 'Erro ao atualizar estação' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/radio-station
// Apaga a estação do usuário logado (e todas as FaixaEstacao em cascata).
// Não afeta outras estações nem a estação padrão.
// ============================================================
export async function DELETE(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const estacao = await db.estacaoRadio.findUnique({
      where: { usuarioId: userId },
    });

    if (!estacao) {
      return NextResponse.json({ error: 'Estação não encontrada' }, { status: 404 });
    }

    await db.estacaoRadio.delete({
      where: { id: estacao.id },
    });

    return NextResponse.json({ message: 'Estação apagada' });
  } catch (error) {
    console.error('[RADIO STATION DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar estação' }, { status: 500 });
  }
}
