import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { criarNotificacao } from '@/lib/notifications';
import type { Follow } from '@/types';

// GET /api/follow?user_id=xxx&artist_id=xxx
// - user_id sozinho: lista todos os artistas que esse usuário segue
// - artist_id sozinho: lista todos os que seguem esse artista (raramente usado, mas simétrico)
// - os dois juntos: usado pra saber se ESSE usuário segue ESSE artista específico
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const artistId = searchParams.get('artist_id');

    if (!isNeonConfigured) {
      return NextResponse.json({ follows: [] });
    }

    const where: Record<string, string> = {};
    if (userId) where.usuarioId = userId;
    if (artistId) where.artistaId = artistId;

    const registros = await db.seguindo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const follows: Follow[] = registros.map((f) => ({
      id: f.id,
      user_id: f.usuarioId,
      artist_id: f.artistaId,
      created_at: f.createdAt.toISOString(),
    }));

    return NextResponse.json({ follows });
  } catch (error) {
    console.error('[FOLLOW GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar seguidores' }, { status: 500 });
  }
}

// POST /api/follow — Toggle seguir/deixar de seguir um artista (autenticado).
// Além de criar/apagar o registro de relação, mantém o contador
// `seguidoresCount` do artista em sincronia — é ele que aparece na tela
// como "X seguidores", então sem esse incremento/decremento o número
// ficaria congelado mesmo com o botão funcionando.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { artist_id } = await request.json();
    if (!artist_id) {
      return NextResponse.json({ error: 'artist_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ message: 'Neon não configurado' }, { status: 503 });
    }

    const artista = await db.artista.findUnique({ where: { id: artist_id } });
    if (!artista) {
      return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 });
    }

    // Um artista não pode seguir a si mesmo (dono do próprio perfil).
    if (artista.usuarioId === userId) {
      return NextResponse.json({ error: 'Você não pode seguir seu próprio artista' }, { status: 400 });
    }

    const existing = await db.seguindo.findUnique({
      where: {
        usuarioId_artistaId: {
          usuarioId: userId,
          artistaId: artist_id,
        },
      },
    });

    if (existing) {
      // Deixar de seguir
      const [, artistaAtualizado] = await db.$transaction([
        db.seguindo.delete({ where: { id: existing.id } }),
        db.artista.update({
          where: { id: artist_id },
          data: { seguidoresCount: { decrement: 1 } },
        }),
      ]);

      return NextResponse.json({
        following: false,
        followers_count: Math.max(0, artistaAtualizado.seguidoresCount),
      });
    }

    // Seguir
    const [seguindo, artistaAtualizado] = await db.$transaction([
      db.seguindo.create({
        data: {
          usuarioId: userId,
          artistaId: artist_id,
        },
      }),
      db.artista.update({
        where: { id: artist_id },
        data: { seguidoresCount: { increment: 1 } },
      }),
    ]);

    // Avisa o dono do artista (artistas sem dono, ex: seed/demo, não notificam ninguém).
    if (artista.usuarioId) {
      await criarNotificacao({
        usuarioId: artista.usuarioId,
        atorId: userId,
        tipo: 'SEGUIDOR_ARTISTA',
        artistaId: artist_id,
      });
    }

    return NextResponse.json({
      following: true,
      followers_count: artistaAtualizado.seguidoresCount,
      follow: {
        id: seguindo.id,
        user_id: seguindo.usuarioId,
        artist_id: seguindo.artistaId,
        created_at: seguindo.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[FOLLOW POST]', error);
    return NextResponse.json({ error: 'Erro ao processar seguir' }, { status: 500 });
  }
}
