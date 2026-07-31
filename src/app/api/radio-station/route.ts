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
    is_active: estacao.ativa,
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
// ?mine=1         → estação do usuário logado (autenticado)
// (sem query)     → estação globalmente ativa (público)
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get('mine') === '1') {
      // --- Estação do próprio usuário ---
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

    // --- Estação globalmente ativa (pública) ---
    if (!isNeonConfigured) {
      return NextResponse.json({ station: null });
    }

    const estacao = await db.estacaoRadio.findFirst({
      where: { ativa: true },
      include: {
        usuario: { select: { id: true, name: true, avatarUrl: true } },
        faixasEstacao: {
          include: { faixa: { include: { artista: { select: { nome: true } } } } },
        },
      },
    });

    if (!estacao) {
      return NextResponse.json({ station: null });
    }

    return NextResponse.json({ station: stationToResponse(estacao, true, true) });
  } catch (error) {
    console.error('[RADIO STATION GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar estação' }, { status: 500 });
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
    const { name, cover_url, track_ids } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }

    if (!Array.isArray(track_ids) || track_ids.length === 0) {
      return NextResponse.json({ error: 'track_ids deve ser um array não vazio' }, { status: 400 });
    }

    // Verifica se as faixas informadas realmente existem no catálogo.
    const existingTracks = await db.faixa.findMany({
      where: { id: { in: track_ids } },
      select: { id: true },
    });
    const validIds = new Set(existingTracks.map((t) => t.id));
    // Filtra só os IDs que existem de verdade (ignora os que foram apagados).
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
      },
      update: {
        nome: name.trim(),
        capaUrl: cover_url || null,
      },
      include: {
        faixasEstacao: {
          include: { faixa: { include: { artista: { select: { nome: true } } } } },
        },
      },
    });

    // Substitui a lista de faixas da estação pela nova lista ordenada.
    // Deleta as entradas antigas e cria as novas — é a abordagem mais
    // simples e consistente com o padrão do projeto.
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
// { "action": "activate" } → ativa esta estação (desativa qualquer outra)
// { "action": "deactivate" } → desativa esta estação
// { "action": "advance" } → avança a faixa atual da estação (quando uma faixa termina)
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

    if (action === 'activate') {
      // Desativa qualquer outra estação que esteja ativa no momento.
      await db.estacaoRadio.updateMany({
        where: { ativa: true },
        data: { ativa: false },
      });

      // Ativa esta estação e define a primeira faixa como atual.
      const faixasOrdenadas = estacao.faixasEstacao
        .filter((fe) => fe.faixa !== null)
        .sort((a, b) => a.ordem - b.ordem);

      const updated = await db.estacaoRadio.update({
        where: { id: estacao.id },
        data: {
          ativa: true,
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

    if (action === 'deactivate') {
      const updated = await db.estacaoRadio.update({
        where: { id: estacao.id },
        data: {
          ativa: false,
          faixaAtualId: null,
          faixaAtualInicio: null,
        },
      });

      return NextResponse.json({ station: stationToResponse(updated) });
    }

    if (action === 'advance') {
      // Avança para a próxima faixa da estação. Chamado pelo cliente quando
      // a faixa atual termina de tocar. Só faz sentido se a estação está ativa.
      if (!estacao.ativa || !estacao.faixaAtualId) {
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

    return NextResponse.json({ error: 'Ação inválida. Use "activate", "deactivate" ou "advance".' }, { status: 400 });
  } catch (error) {
    console.error('[RADIO STATION PATCH]', error);
    return NextResponse.json({ error: 'Erro ao atualizar estação' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/radio-station
// Apaga a estação do usuário logado (e todas as FaixaEstacao em cascata).
// Se a estação estava ativa, volta ao shuffle padrão para todo mundo.
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

    // findUnique para confirmar que existe antes de apagar.
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
