import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MODERATION_SECRET, isNeonConfigured } from '@/lib/config';
import type { Track } from '@/types';

function isModerator(request: Request): boolean {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${MODERATION_SECRET}`;
}

// Serializa uma rádio oficial para JSON (com ou sem faixas).
function serializeRadio(radio: {
  id: string;
  nome: string;
  capaUrl: string | null;
  publicada: boolean;
  onAir: boolean;
  faixaAtualId: string | null;
  faixaAtualInicio: Date | null;
  createdAt: Date;
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
}, includeTracks = false) {
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
    publicada: radio.publicada,
    on_air: radio.onAir,
    current_track_id: radio.faixaAtualId,
    current_track_started_at: radio.faixaAtualInicio?.toISOString() ?? null,
    created_at: radio.createdAt.toISOString(),
    ...(includeTracks ? { tracks } : {}),
    tracks_count: tracks.length,
  };
}

// GET /api/moderacao/official-radios — Lista todas as rádios oficiais.
// ?id=xxx  -> detalhes de uma rádio específica (com faixas).
export async function GET(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ radios: [] });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const radio = await db.radioOficial.findUnique({
        where: { id },
        include: {
          faixas: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });
      if (!radio) {
        return NextResponse.json({ error: 'Rádio não encontrada' }, { status: 404 });
      }
      return NextResponse.json({ radio: serializeRadio(radio, true) });
    }

    const radios = await db.radioOficial.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        faixas: {
          include: { faixa: { include: { artista: { select: { nome: true } } } } },
        },
      },
    });

    return NextResponse.json({
      radios: radios.map((r) => serializeRadio(r, true)),
    });
  } catch (error) {
    console.error('[MODERACAO OFFICIAL RADIOS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar rádios oficiais' }, { status: 500 });
  }
}

// POST /api/moderacao/official-radios — Cria uma nova rádio oficial.
export async function POST(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { nome, capa_url } = await request.json();

    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 });
    }

    const radio = await db.radioOficial.create({
      data: {
        nome: nome.trim().slice(0, 60),
        capaUrl: capa_url || null,
      },
      include: {
        faixas: {
          include: { faixa: { include: { artista: { select: { nome: true } } } } },
        },
      },
    });

    return NextResponse.json({ radio: serializeRadio(radio, true) }, { status: 201 });
  } catch (error) {
    console.error('[MODERACAO OFFICIAL RADIOS POST]', error);
    return NextResponse.json({ error: 'Erro ao criar rádio oficial' }, { status: 500 });
  }
}

// PATCH /api/moderacao/official-radios — Edita uma rádio oficial.
// Actions: 'edit_info', 'set_tracks', 'publish', 'unpublish',
//          'put_on_air', 'take_off_air'
export async function PATCH(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const existing = await db.radioOficial.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Rádio não encontrada' }, { status: 404 });
    }

    // --- Editar nome/capa ---
    if (action === 'edit_info') {
      const nome = typeof body.nome === 'string' ? body.nome.trim().slice(0, 60) : undefined;
      const capaUrl = typeof body.capa_url === 'string' ? body.capa_url.trim() : undefined;

      if (nome === '') {
        return NextResponse.json({ error: 'nome não pode ser vazio' }, { status: 400 });
      }

      const radio = await db.radioOficial.update({
        where: { id },
        data: {
          ...(nome !== undefined ? { nome } : {}),
          ...(capaUrl !== undefined ? { capaUrl: capaUrl || null } : {}),
        },
        include: {
          faixas: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });

      return NextResponse.json({ radio: serializeRadio(radio, true) });
    }

    // --- Definir playlist ---
    if (action === 'set_tracks') {
      const trackIds: string[] = body.track_ids;
      if (!Array.isArray(trackIds)) {
        return NextResponse.json({ error: 'track_ids deve ser um array' }, { status: 400 });
      }

      // Valida que as faixas existem e não estão apagadas.
      const existingTracks = await db.faixa.findMany({
        where: { id: { in: trackIds }, deletedAt: null },
        select: { id: true },
      });
      const validIds = new Set(existingTracks.map((t) => t.id));
      const validTrackIds = trackIds.filter((id: string) => validIds.has(id));

      await db.faixaRadioOficial.deleteMany({ where: { radioId: id } });
      if (validTrackIds.length > 0) {
        await db.faixaRadioOficial.createMany({
          data: validTrackIds.map((faixaId: string, index: number) => ({
            radioId: id,
            faixaId,
            ordem: index,
          })),
        });
      }

      // Reinicia a faixa atual se a playlist mudou.
      await db.radioOficial.update({
        where: { id },
        data: {
          faixaAtualId: validTrackIds[0] ?? null,
          faixaAtualInicio: validTrackIds.length > 0 ? new Date() : null,
        },
      });

      const radio = await db.radioOficial.findUnique({
        where: { id },
        include: {
          faixas: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });

      return NextResponse.json({ radio: serializeRadio(radio!, true) });
    }

    // --- Publicar ---
    if (action === 'publish') {
      const radio = await db.radioOficial.update({
        where: { id },
        data: { publicada: true },
        include: {
          faixas: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });
      return NextResponse.json({ radio: serializeRadio(radio, true) });
    }

    // --- Despublicar ---
    if (action === 'unpublish') {
      const radio = await db.radioOficial.update({
        where: { id },
        data: { publicada: false },
        include: {
          faixas: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });
      return NextResponse.json({ radio: serializeRadio(radio, true) });
    }

    // --- Colocar no ar ---
    if (action === 'put_on_air') {
      // Retira do ar qualquer outra que estivesse.
      await db.radioOficial.updateMany({
        where: { onAir: true },
        data: { onAir: false },
      });

      const radio = await db.radioOficial.update({
        where: { id },
        data: {
          onAir: true,
          publicada: true, // Colocar no ar implica publicar.
          // Reinicia a faixa atual.
          faixaAtualInicio: new Date(),
        },
        include: {
          faixas: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });

      // Se não tem faixaAtualId definido, coloca a primeira da playlist.
      if (!radio.faixaAtualId) {
        const firstTrack = (radio.faixas || [])
          .filter((fr) => fr.faixa)
          .sort((a, b) => a.ordem - b.ordem)[0];
        if (firstTrack) {
          await db.radioOficial.update({
            where: { id },
            data: { faixaAtualId: firstTrack.faixaId },
          });
          radio.faixaAtualId = firstTrack.faixaId;
        }
      }

      return NextResponse.json({ radio: serializeRadio(radio, true) });
    }

    // --- Retirar do ar ---
    if (action === 'take_off_air') {
      const radio = await db.radioOficial.update({
        where: { id },
        data: { onAir: false },
        include: {
          faixas: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });
      return NextResponse.json({ radio: serializeRadio(radio, true) });
    }

    // --- Avançar faixa ---
    if (action === 'advance') {
      const radioComFaixas = await db.radioOficial.findUnique({
        where: { id },
        include: {
          faixas: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });

      const faixasOrdenadas = (radioComFaixas?.faixas || [])
        .filter((fr) => fr.faixa)
        .sort((a, b) => a.ordem - b.ordem);

      if (faixasOrdenadas.length === 0) {
        return NextResponse.json({ radio: serializeRadio(radio, true) });
      }

      const currentIdx = faixasOrdenadas.findIndex((fr) => fr.faixaId === existing.faixaAtualId);
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % faixasOrdenadas.length : 0;

      const radio = await db.radioOficial.update({
        where: { id },
        data: {
          faixaAtualId: faixasOrdenadas[nextIdx].faixaId,
          faixaAtualInicio: new Date(),
        },
        include: {
          faixas: {
            include: { faixa: { include: { artista: { select: { nome: true } } } } },
          },
        },
      });

      return NextResponse.json({ radio: serializeRadio(radio, true) });
    }

    return NextResponse.json(
      { error: 'Ação inválida. Use "edit_info", "set_tracks", "publish", "unpublish", "put_on_air", "take_off_air" ou "advance".' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[MODERACAO OFFICIAL RADIOS PATCH]', error);
    return NextResponse.json({ error: 'Erro ao atualizar rádio oficial' }, { status: 500 });
  }
}

// DELETE /api/moderacao/official-radios?id=xxx — Apaga uma rádio oficial.
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

    const existing = await db.radioOficial.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Rádio não encontrada' }, { status: 404 });
    }

    // CASCADE apaga as faixas da rádio junto.
    await db.radioOficial.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[MODERACAO OFFICIAL RADIOS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar rádio oficial' }, { status: 500 });
  }
}
