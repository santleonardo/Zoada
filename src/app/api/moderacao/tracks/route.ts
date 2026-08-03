import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MODERATION_SECRET, isNeonConfigured } from '@/lib/config';
import { notDeleted } from '@/lib/soft-delete';

function isModerator(request: Request): boolean {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${MODERATION_SECRET}`;
}

function serializeTrack(faixa: {
  id: string;
  titulo: string;
  artistaId: string;
  coverUrl: string | null;
  audioUrl: string | null;
  audioUrlLow: string | null;
  duracao: number;
  playsCount: number;
  createdAt: Date;
  artista?: { nome: string; avatarUrl: string | null } | null;
}) {
  return {
    id: faixa.id,
    title: faixa.titulo,
    artist_id: faixa.artistaId,
    artist_name: faixa.artista?.nome || '',
    cover_url: faixa.coverUrl || faixa.artista?.avatarUrl || null,
    audio_url: faixa.audioUrl,
    audio_url_low: faixa.audioUrlLow,
    duration: faixa.duracao,
    plays_count: faixa.playsCount,
    created_at: faixa.createdAt.toISOString(),
  };
}

// GET /api/moderacao/tracks
// Lista faixas do catálogo (não apagadas) para o painel.
// ?artist_id=xxx  filtra por artista
// ?q=texto        busca por título ou nome do artista
export async function GET(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ tracks: [] });
    }

    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artist_id');
    const q = (searchParams.get('q') || '').trim();

    const where: Record<string, unknown> = { ...notDeleted };
    if (artistId) where.artistaId = artistId;
    if (q) {
      where.OR = [
        { titulo: { contains: q, mode: 'insensitive' } },
        { artista: { nome: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const faixas = await db.faixa.findMany({
      where,
      include: { artista: { select: { nome: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return NextResponse.json({
      tracks: faixas.map(serializeTrack),
    });
  } catch (error) {
    console.error('[MODERACAO TRACKS GET]', error);
    return NextResponse.json({ error: 'Erro ao listar faixas' }, { status: 500 });
  }
}

// POST /api/moderacao/tracks — Cria uma faixa no catálogo usando
// MODERATION_SECRET. O moderador já fez o upload do áudio pro R2
// e agora registra a faixa no banco. Não verifica dono do artista.
export async function POST(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { titulo, artistaId, coverUrl, audioUrl, duracao } = await request.json();

    if (!titulo || !artistaId || !audioUrl) {
      return NextResponse.json({ error: 'titulo, artistaId e audioUrl são obrigatórios' }, { status: 400 });
    }

    const artista = await db.artista.findUnique({ where: { id: artistaId } });
    if (!artista) {
      return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 });
    }

    const faixa = await db.faixa.create({
      data: {
        titulo: titulo.trim().slice(0, 200),
        artistaId,
        coverUrl: coverUrl || null,
        audioUrl,
        duracao: duracao || 0,
      },
      include: { artista: { select: { nome: true, avatarUrl: true } } },
    });

    return NextResponse.json(serializeTrack(faixa), { status: 201 });
  } catch (error) {
    console.error('[MODERACAO TRACKS POST]', error);
    return NextResponse.json({ error: 'Erro ao criar faixa' }, { status: 500 });
  }
}

// PUT /api/moderacao/tracks?id=xxx — Edita título/capa de qualquer faixa
// (sem checar dono; autenticação só por MODERATION_SECRET).
export async function PUT(request: Request) {
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

    const body = await request.json();
    const { titulo, coverUrl, artistaId } = body;

    const existing = await db.faixa.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
    }

    if (artistaId) {
      const artista = await db.artista.findUnique({ where: { id: artistaId } });
      if (!artista) {
        return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 });
      }
    }

    const faixa = await db.faixa.update({
      where: { id },
      data: {
        ...(titulo !== undefined ? { titulo: String(titulo).trim().slice(0, 200) } : {}),
        ...(coverUrl !== undefined ? { coverUrl: coverUrl || null } : {}),
        ...(artistaId !== undefined ? { artistaId } : {}),
      },
      include: { artista: { select: { nome: true, avatarUrl: true } } },
    });

    return NextResponse.json(serializeTrack(faixa));
  } catch (error) {
    console.error('[MODERACAO TRACKS PUT]', error);
    return NextResponse.json({ error: 'Erro ao editar faixa' }, { status: 500 });
  }
}

// DELETE /api/moderacao/tracks?id=xxx — Soft-delete de qualquer faixa
// (marca deletedAt; mesma regra de retenção do app).
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

    const faixa = await db.faixa.findUnique({ where: { id } });
    if (!faixa) {
      return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
    }
    if (faixa.deletedAt) {
      return NextResponse.json({ error: 'Essa faixa já foi apagada' }, { status: 409 });
    }

    await db.faixa.update({ where: { id }, data: { deletedAt: new Date() } });

    return NextResponse.json({ deleted: true, retention_days: 30 });
  } catch (error) {
    console.error('[MODERACAO TRACKS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar faixa' }, { status: 500 });
  }
}
