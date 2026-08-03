import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isNeonConfigured } from '@/lib/config';
import type { Track } from '@/types';

function serializeRadioPublic(radio: {
  id: string;
  nome: string;
  capaUrl: string | null;
  publicada: boolean;
  onAir: boolean;
  faixaAtualId: string | null;
  faixaAtualInicio: Date | null;
  faixas?: Array<{
    faixaId: string;
    ordem: number;
    faixa: {
      id: string;
      titulo: string;
      artistaId: string;
      coverUrl: string | null;
      audioUrl: string | null;
      audioUrlLow: string | null;
      duracao: number;
      playsCount: number;
      createdAt: Date;
      artista: { nome: string } | null;
    };
  }>;
}) {
  const tracks: Track[] = (radio.faixas || [])
    .filter((fr) => fr.faixa)
    .sort((a, b) => a.ordem - b.ordem)
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
    id: radio.id,
    nome: radio.nome,
    cover_url: radio.capaUrl,
    on_air: radio.onAir,
    current_track_id: radio.faixaAtualId,
    current_track_started_at: radio.faixaAtualInicio?.toISOString() ?? null,
    tracks_count: tracks.length,
    tracks,
  };
}

// GET /api/official-radios
// ?on_air=1  -> retorna só a rádio que está no ar (null se nenhuma)
// Sem query   -> retorna todas as rádios publicadas (sem faixas, só resumo)
// ?id=xxx   -> retorna uma rádio publicada com faixas
export async function GET(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ on_air_radio: null, radios: [] });
    }

    const { searchParams } = new URL(request.url);
    const onAir = searchParams.get('on_air') === '1';
    const id = searchParams.get('id');

    if (onAir) {
      const radio = await db.radioOficial.findFirst({
        where: { onAir: true, publicada: true },
        include: {
          faixas: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });
      return NextResponse.json({
        on_air_radio: radio ? serializeRadioPublic(radio) : null,
      });
    }

    if (id) {
      const radio = await db.radioOficial.findUnique({
        where: { id, publicada: true },
        include: {
          faixas: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });
      if (!radio) {
        return NextResponse.json({ error: 'Rádio não encontrada' }, { status: 404 });
      }
      return NextResponse.json({ radio: serializeRadioPublic(radio) });
    }

    // Lista todas as rádios publicadas (resumo, sem faixas).
    const radios = await db.radioOficial.findMany({
      where: { publicada: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      radios: radios.map((r) => ({
        id: r.id,
        nome: r.nome,
        cover_url: r.capaUrl,
        on_air: r.onAir,
        tracks_count: r.faixas.length || 0,
      })),
    });
  } catch (error) {
    console.error('[OFFICIAL RADIOS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar rádios oficiais' }, { status: 500 });
  }
}
