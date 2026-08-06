import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isNeonConfigured, RADIO_PADRAO_ID } from '@/lib/config';
import type { RadioPadrao, Track } from '@/types';

// ============================================================
// /api/radio-padrao — Estado atual da "Rádio Zôada", a estação padrão do
// app (dial '__default__' em RadioScreen.tsx). É uma SINGLETON: só existe
// uma linha (id fixo RADIO_PADRAO_ID), gerenciada pelo painel de
// moderação (ver /api/moderacao/radio).
//
// GET — público, sem autenticação: qualquer pessoa que abrir o app precisa
// poder ler isso pra saber o que a Rádio Zôada está tocando agora. A
// escrita (playlist, pausar, avançar faixa, nome/capa, agendamentos) só
// existe em /api/moderacao/radio, protegida por MODERATION_SECRET.
//
// Agendamentos (RadioAgendamento): se algum agendamento ativo cobrir o
// instante atual (inicio <= agora < fim), a playlist dele substitui a
// playlist normal enquanto durar — sem precisar de cron nem de nenhuma
// ação da moderação no momento exato. Isso funciona porque o app já faz
// polling desse endpoint a cada 6s (ver RadioScreen.tsx): no próximo
// poll depois do horário de início, o agendamento "liga" sozinho; no
// primeiro poll depois do horário de fim, ele já não bate mais no filtro
// abaixo e o app volta sozinho ao estado normal (playlist manual ou
// shuffle do catálogo).
// ============================================================

// Encontra qualquer track dentro de uma lista pelo id — usado pra calcular
// qual faixa do agendamento deveria estar tocando agora.
function trackDuration(t: Track): number {
  return t.duration && t.duration > 0 ? t.duration : 180; // fallback: 3min pra faixas sem duração salva
}

// Dado um agendamento e "agora", calcula deterministicamente qual faixa da
// playlist agendada deveria estar tocando e desde quando — sem precisar
// gravar nada no banco (o GET público não escreve). O cálculo é só
// aritmética sobre a soma das durações das faixas, em loop.
function computeAgendamentoPlayhead(tracks: Track[], inicio: Date, now: Date): { trackId: string; startedAt: Date } | null {
  if (tracks.length === 0) return null;
  const total = tracks.reduce((sum, t) => sum + trackDuration(t), 0);
  if (total <= 0) return null;

  const elapsedTotal = Math.max(0, (now.getTime() - inicio.getTime()) / 1000);
  const elapsedInLoop = elapsedTotal % total;

  let acc = 0;
  for (const t of tracks) {
    const dur = trackDuration(t);
    if (elapsedInLoop < acc + dur) {
      const startedAt = new Date(now.getTime() - (elapsedInLoop - acc) * 1000);
      return { trackId: t.id, startedAt };
    }
    acc += dur;
  }
  // Não deveria cair aqui, mas por segurança volta pra primeira faixa.
  return { trackId: tracks[0].id, startedAt: now };
}

export async function GET() {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ radio: null });
    }

    const radio = await db.radioPadrao.findUnique({
      where: { id: RADIO_PADRAO_ID },
      include: {
        faixas: {
          orderBy: { ordem: 'asc' },
          include: { faixa: { include: { artista: { select: { nome: true } } } } },
        },
      },
    });

    if (!radio) {
      // Ainda não foi configurada pela moderação — o cliente cai de volta
      // pro comportamento padrão (shuffle do catálogo inteiro).
      return NextResponse.json({ radio: null });
    }

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

    const response: RadioPadrao = {
      nome: radio.nome,
      cover_url: radio.capaUrl,
      pausada: radio.pausada,
      current_track_id: radio.faixaAtualId,
      current_track_started_at: radio.faixaAtualInicio?.toISOString() ?? null,
      tracks,
    };

    // Verifica se algum agendamento está valendo agora e, se estiver,
    // sobrepõe a playlist/estado normal com a playlist agendada.
    const now = new Date();
    const agendamentoAtivo = await db.radioAgendamento.findFirst({
      where: { radioId: radio.id, ativo: true, inicio: { lte: now }, fim: { gt: now } },
      orderBy: { inicio: 'desc' }, // se houver sobreposição, o mais recente a começar vence
      include: {
        faixas: {
          orderBy: { ordem: 'asc' },
          include: { faixa: { include: { artista: { select: { nome: true } } } } },
        },
      },
    });

    if (agendamentoAtivo) {
      const agendamentoTracks: Track[] = agendamentoAtivo.faixas
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

      const playhead = computeAgendamentoPlayhead(agendamentoTracks, agendamentoAtivo.inicio, now);

      response.pausada = false;
      response.tracks = agendamentoTracks;
      response.current_track_id = playhead?.trackId ?? null;
      response.current_track_started_at = playhead?.startedAt.toISOString() ?? null;
      response.agendamento_ativo = {
        id: agendamentoAtivo.id,
        nome: agendamentoAtivo.nome,
        fim: agendamentoAtivo.fim.toISOString(),
      };
    }

    return NextResponse.json({ radio: response });
  } catch (error) {
    console.error('[RADIO PADRAO GET]', error);
    return NextResponse.json({ radio: null });
  }
}
