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
// escrita (playlist, pausar, avançar faixa, nome/capa) só existe em
// /api/moderacao/radio, protegida por MODERATION_SECRET.
// ============================================================

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

    return NextResponse.json({ radio: response });
  } catch (error) {
    console.error('[RADIO PADRAO GET]', error);
    return NextResponse.json({ radio: null });
  }
}
