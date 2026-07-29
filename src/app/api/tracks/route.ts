import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured, isR2Configured } from '@/lib/config';
import { deleteFromR2, keyFromPublicUrl } from '@/lib/r2';
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

// DELETE /api/tracks?id=xxx — Remove uma faixa (autenticado)
//
// Observação: assim como no POST, o app hoje não guarda qual usuário é
// "dono" de qual artista (o modelo Artista não tem essa relação no banco),
// então a mesma regra frouxa vale aqui: qualquer usuário autenticado pode
// apagar. Isso é consistente com o resto da API, mas vale reforçar a
// autenticação de verdade quando essa relação existir.
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

    const faixa = await db.faixa.findUnique({ where: { id } });
    if (!faixa) {
      return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
    }

    // Apaga a linha do banco primeiro (é o que realmente importa pro app
    // parar de mostrar a faixa); apagar os arquivos no R2 é best-effort —
    // se falhar, não desfazemos a exclusão, só avisamos no log.
    await db.faixa.delete({ where: { id } });

    if (isR2Configured) {
      const audioKey = faixa.audioUrl ? keyFromPublicUrl(faixa.audioUrl) : null;
      const coverKey = faixa.coverUrl ? keyFromPublicUrl(faixa.coverUrl) : null;

      await Promise.all([
        audioKey
          ? deleteFromR2(audioKey).catch((err) => console.warn('[TRACKS DELETE] falha ao apagar áudio no R2:', err))
          : null,
        coverKey
          ? deleteFromR2(coverKey).catch((err) => console.warn('[TRACKS DELETE] falha ao apagar capa no R2:', err))
          : null,
      ]);
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[TRACKS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao apagar faixa' }, { status: 500 });
  }
}
