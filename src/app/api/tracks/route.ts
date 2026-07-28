import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { DEMO_TRACKS } from '@/lib/demo-data';

// GET /api/tracks?artist_id=xxx
// Return all tracks, optionally filtered by artist
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artist_id');

    if (!isNeonConfigured) {
      // Demo mode
      let tracks = DEMO_TRACKS;
      if (artistId) tracks = tracks.filter((t) => t.artist_id === artistId);
      return NextResponse.json({ tracks });
    }

    const where = artistId ? { artistaId: artistId } : {};
    const faixas = await db.faixa.findMany({
      where,
      include: {
        artista: { select: { id: true, nome: true, avatarUrl: true } },
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
      duration: f.duracao,
      plays_count: f.playsCount,
      created_at: f.createdAt.toISOString(),
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

    const { titulo, artistaId, coverUrl, audioUrl, duracao } = await request.json();

    if (!titulo || !artistaId) {
      return NextResponse.json({ error: 'titulo e artistaId são obrigatórios' }, { status: 400 });
    }

    // Verify artist exists
    const artista = await db.artista.findUnique({ where: { id: artistaId } });
    if (!artista) {
      return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 });
    }

    const faixa = await db.faixa.create({
      data: {
        titulo,
        artistaId,
        coverUrl: coverUrl || null,
        audioUrl: audioUrl || null,
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
      duration: faixa.duracao,
      plays_count: faixa.playsCount,
      created_at: faixa.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('[TRACKS POST]', error);
    return NextResponse.json({ error: 'Erro ao criar faixa' }, { status: 500 });
  }
}
