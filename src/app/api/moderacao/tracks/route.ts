import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MODERATION_SECRET, isNeonConfigured } from '@/lib/config';

function isModerator(request: Request): boolean {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${MODERATION_SECRET}`;
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

    return NextResponse.json({
      id: faixa.id,
      title: faixa.titulo,
      artist_id: faixa.artistaId,
      artist_name: faixa.artista.nome,
      cover_url: faixa.coverUrl || faixa.artista.avatarUrl || null,
      audio_url: faixa.audioUrl,
      audio_url_low: faixa.audioUrlLow,
      duration: faixa.duracao,
      plays_count: faixa.playsCount,
      created_at: faixa.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('[MODERACAO TRACKS POST]', error);
    return NextResponse.json({ error: 'Erro ao criar faixa' }, { status: 500 });
  }
}
