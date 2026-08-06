import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isNeonConfigured, MODERATION_SECRET, RADIO_PADRAO_ID } from '@/lib/config';
import type { RadioPadrao, RadioAgendamento, Track } from '@/types';
import { isValidBearerSecret } from '@/lib/rateLimit';

// ============================================================
// /api/moderacao/radio — Controle total da "Rádio Zôada" (a estação
// padrão do app) pelo painel de moderação (public/moderacao/index.html).
// Mesmo padrão de autenticação de /api/reports e /api/aviso: header
// `Authorization: Bearer <MODERATION_SECRET>`.
//
// GET   — estado atual (playlist, nome, capa, pausada, faixa atual) +
//         lista de agendamentos cadastrados (ver mais abaixo).
// PATCH — { action: 'set_info',   nome?, capa_url? }
//         { action: 'set_tracks', track_ids: string[] }  (ordem = ordem do array)
//         { action: 'pause' } / { action: 'resume' }
//         { action: 'advance' }  → pula pra próxima faixa da playlist
//         { action: 'create_schedule', track_ids, inicio, fim, nome? }
//           → agenda uma playlist pra tocar automaticamente entre `inicio`
//             e `fim` (strings ISO). Fora da moderação manual: enquanto o
//             agendamento estiver valendo, ele manda na Rádio Zôada; ao
//             terminar, o app volta sozinho ao estado normal (ver
//             /api/radio-padrao, que calcula isso a cada leitura).
//         { action: 'update_schedule', id, track_ids?, inicio?, fim?, nome?, ativo? }
//         { action: 'delete_schedule', id }
//
// A leitura pública (usada pelo app) fica em /api/radio-padrao.
// ============================================================

function isModerator(request: Request): boolean {
  return isValidBearerSecret(request, MODERATION_SECRET);
}

// Garante que a linha singleton existe, criando com valores padrão na
// primeira vez que a moderação mexe na Rádio Zôada.
async function getOrCreateRadio() {
  const existing = await db.radioPadrao.findUnique({ where: { id: RADIO_PADRAO_ID } });
  if (existing) return existing;
  return db.radioPadrao.create({
    data: { id: RADIO_PADRAO_ID, nome: 'Rádio Zôada' },
  });
}

async function loadWithTracks(radioId: string) {
  return db.radioPadrao.findUnique({
    where: { id: radioId },
    include: {
      faixas: {
        orderBy: { ordem: 'asc' },
        include: { faixa: { include: { artista: { select: { nome: true } } } } },
      },
    },
  });
}

function toResponse(radio: NonNullable<Awaited<ReturnType<typeof loadWithTracks>>>): RadioPadrao {
  const tracks: Track[] = radio.faixas
    .filter((fr) => fr.faixa)
    .map((fr) => ({
      id: fr.faixa.id,
      title: fr.faixa.titulo,
      artist_id: fr.faixa.artistaId,
      artist_name: fr.faixa.artista?.nome || '',
      cover_url: fr.faixa.coverUrl || '',
      audio_url: fr.faixa.audioUrl || '',
      audio_url_low: fr.faixa.audioUrlLow || null,
      duration: fr.faixa.duracao,
      plays_count: fr.faixa.playsCount,
      created_at: fr.faixa.createdAt.toISOString(),
    }));

  return {
    nome: radio.nome,
    cover_url: radio.capaUrl,
    pausada: radio.pausada,
    current_track_id: radio.faixaAtualId,
    current_track_started_at: radio.faixaAtualInicio?.toISOString() ?? null,
    tracks,
  };
}

async function loadAgendamentos(radioId: string): Promise<RadioAgendamento[]> {
  const agendamentos = await db.radioAgendamento.findMany({
    where: { radioId },
    orderBy: { inicio: 'asc' },
    include: {
      faixas: {
        orderBy: { ordem: 'asc' },
        include: { faixa: { include: { artista: { select: { nome: true } } } } },
      },
    },
  });

  return agendamentos.map((a) => {
    const tracks: Track[] = a.faixas
      .filter((fr) => fr.faixa)
      .map((fr) => ({
        id: fr.faixa.id,
        title: fr.faixa.titulo,
        artist_id: fr.faixa.artistaId,
        artist_name: fr.faixa.artista?.nome || '',
        cover_url: fr.faixa.coverUrl || '',
        audio_url: fr.faixa.audioUrl || '',
        audio_url_low: fr.faixa.audioUrlLow || null,
        duration: fr.faixa.duracao,
        plays_count: fr.faixa.playsCount,
        created_at: fr.faixa.createdAt.toISOString(),
      }));

    return {
      id: a.id,
      nome: a.nome,
      inicio: a.inicio.toISOString(),
      fim: a.fim.toISOString(),
      ativo: a.ativo,
      track_ids: tracks.map((t) => t.id),
      tracks,
    };
  });
}

export async function GET(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const created = await getOrCreateRadio();
    const radio = await loadWithTracks(RADIO_PADRAO_ID);
    const agendamentos = await loadAgendamentos(created.id);
    return NextResponse.json({ radio: toResponse(radio!), agendamentos });
  } catch (error) {
    console.error('[MODERACAO RADIO GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar a Rádio Zôada' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    const current = await getOrCreateRadio();

    if (action === 'set_info') {
      const nome = typeof body.nome === 'string' ? body.nome.trim().slice(0, 60) : undefined;
      const capaUrl = typeof body.capa_url === 'string' ? body.capa_url.trim() : undefined;

      if (nome === '') {
        return NextResponse.json({ error: 'nome não pode ser vazio' }, { status: 400 });
      }

      await db.radioPadrao.update({
        where: { id: current.id },
        data: {
          ...(nome !== undefined ? { nome } : {}),
          ...(capaUrl !== undefined ? { capaUrl: capaUrl || null } : {}),
        },
      });

      const radio = await loadWithTracks(current.id);
      return NextResponse.json({ radio: toResponse(radio!) });
    }

    if (action === 'set_tracks') {
      const trackIds = body.track_ids;
      if (!Array.isArray(trackIds)) {
        return NextResponse.json({ error: 'track_ids deve ser um array' }, { status: 400 });
      }

      // Só aceita faixas que realmente existem no catálogo (e não apagadas).
      const existingTracks = await db.faixa.findMany({
        where: { id: { in: trackIds }, deletedAt: null },
        select: { id: true },
      });
      const validIds = new Set(existingTracks.map((t) => t.id));
      const validTrackIds: string[] = trackIds.filter((id: string) => validIds.has(id));

      // Substitui a playlist inteira pela nova, na ordem enviada.
      await db.faixaRadioPadrao.deleteMany({ where: { radioId: current.id } });
      if (validTrackIds.length > 0) {
        await db.faixaRadioPadrao.createMany({
          data: validTrackIds.map((faixaId, index) => ({
            radioId: current.id,
            faixaId,
            ordem: index,
          })),
        });
      }

      // Reinicia a transmissão a partir da primeira faixa da nova playlist
      // (ou zera o "tocando agora" se a playlist ficou vazia — volta a
      // valer o fallback de shuffle do catálogo no cliente).
      await db.radioPadrao.update({
        where: { id: current.id },
        data: {
          faixaAtualId: validTrackIds[0] ?? null,
          faixaAtualInicio: validTrackIds.length > 0 ? new Date() : null,
        },
      });

      const radio = await loadWithTracks(current.id);
      return NextResponse.json({ radio: toResponse(radio!) });
    }

    if (action === 'pause' || action === 'resume') {
      await db.radioPadrao.update({
        where: { id: current.id },
        data: {
          pausada: action === 'pause',
          // Ao retomar, reinicia a contagem da faixa atual do zero — evita
          // "pular" pro meio da faixa por causa do tempo em pausa.
          ...(action === 'resume' && current.faixaAtualId ? { faixaAtualInicio: new Date() } : {}),
        },
      });

      const radio = await loadWithTracks(current.id);
      return NextResponse.json({ radio: toResponse(radio!) });
    }

    if (action === 'advance') {
      const radioComFaixas = await loadWithTracks(current.id);
      const faixasOrdenadas = (radioComFaixas?.faixas || [])
        .filter((fr) => fr.faixa)
        .sort((a, b) => a.ordem - b.ordem);

      if (faixasOrdenadas.length === 0) {
        return NextResponse.json({ radio: toResponse(radioComFaixas!) });
      }

      const currentIdx = faixasOrdenadas.findIndex((fr) => fr.faixaId === current.faixaAtualId);
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % faixasOrdenadas.length : 0;

      await db.radioPadrao.update({
        where: { id: current.id },
        data: {
          faixaAtualId: faixasOrdenadas[nextIdx].faixaId,
          faixaAtualInicio: new Date(),
        },
      });

      const radio = await loadWithTracks(current.id);
      return NextResponse.json({ radio: toResponse(radio!) });
    }

    if (action === 'create_schedule' || action === 'update_schedule') {
      const isUpdate = action === 'update_schedule';
      const id = typeof body.id === 'string' ? body.id : undefined;
      if (isUpdate && !id) {
        return NextResponse.json({ error: 'id é obrigatório para update_schedule' }, { status: 400 });
      }

      let inicio: Date | undefined;
      let fim: Date | undefined;
      if (body.inicio !== undefined) {
        const d = new Date(body.inicio);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: 'inicio inválido' }, { status: 400 });
        }
        inicio = d;
      }
      if (body.fim !== undefined) {
        const d = new Date(body.fim);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: 'fim inválido' }, { status: 400 });
        }
        fim = d;
      }

      // Na criação os dois são obrigatórios; na edição, se só um vier,
      // valida contra o valor já salvo.
      let existing: { inicio: Date; fim: Date } | null = null;
      if (isUpdate) {
        existing = await db.radioAgendamento.findFirst({
          where: { id, radioId: current.id },
          select: { inicio: true, fim: true },
        });
        if (!existing) {
          return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
        }
      } else if (!inicio || !fim) {
        return NextResponse.json({ error: 'inicio e fim são obrigatórios' }, { status: 400 });
      }

      const inicioFinal = inicio ?? existing!.inicio;
      const fimFinal = fim ?? existing!.fim;
      if (fimFinal <= inicioFinal) {
        return NextResponse.json({ error: 'fim precisa ser depois de inicio' }, { status: 400 });
      }

      const nome = typeof body.nome === 'string' ? body.nome.trim().slice(0, 80) || null : undefined;
      const ativo = typeof body.ativo === 'boolean' ? body.ativo : undefined;

      let trackIds: string[] | undefined;
      if (body.track_ids !== undefined) {
        if (!Array.isArray(body.track_ids)) {
          return NextResponse.json({ error: 'track_ids deve ser um array' }, { status: 400 });
        }
        const existingTracks = await db.faixa.findMany({
          where: { id: { in: body.track_ids }, deletedAt: null },
          select: { id: true },
        });
        const validIds = new Set(existingTracks.map((t) => t.id));
        trackIds = (body.track_ids as string[]).filter((tid) => validIds.has(tid));
      } else if (!isUpdate) {
        trackIds = [];
      }

      if (!isUpdate && (!trackIds || trackIds.length === 0)) {
        return NextResponse.json({ error: 'track_ids não pode ser vazio ao criar um agendamento' }, { status: 400 });
      }

      const agendamento = isUpdate
        ? await db.radioAgendamento.update({
            where: { id: id! },
            data: {
              ...(inicio !== undefined ? { inicio } : {}),
              ...(fim !== undefined ? { fim } : {}),
              ...(nome !== undefined ? { nome } : {}),
              ...(ativo !== undefined ? { ativo } : {}),
            },
          })
        : await db.radioAgendamento.create({
            data: {
              radioId: current.id,
              nome: nome ?? null,
              inicio: inicioFinal,
              fim: fimFinal,
            },
          });

      if (trackIds !== undefined) {
        await db.faixaRadioAgendamento.deleteMany({ where: { agendamentoId: agendamento.id } });
        if (trackIds.length > 0) {
          await db.faixaRadioAgendamento.createMany({
            data: trackIds.map((faixaId, index) => ({
              agendamentoId: agendamento.id,
              faixaId,
              ordem: index,
            })),
          });
        }
      }

      const agendamentos = await loadAgendamentos(current.id);
      return NextResponse.json({ agendamentos });
    }

    if (action === 'delete_schedule') {
      const id = typeof body.id === 'string' ? body.id : undefined;
      if (!id) {
        return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
      }
      await db.radioAgendamento.deleteMany({ where: { id, radioId: current.id } });
      const agendamentos = await loadAgendamentos(current.id);
      return NextResponse.json({ agendamentos });
    }

    return NextResponse.json(
      {
        error:
          'Ação inválida. Use "set_info", "set_tracks", "pause", "resume", "advance", ' +
          '"create_schedule", "update_schedule" ou "delete_schedule".',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('[MODERACAO RADIO PATCH]', error);
    return NextResponse.json({ error: 'Erro ao atualizar a Rádio Zôada' }, { status: 500 });
  }
}
