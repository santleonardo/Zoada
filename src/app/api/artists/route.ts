import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isNeonConfigured } from '@/lib/config';
import { DEMO_ARTISTS } from '@/lib/demo-data';

// GET /api/artists
// Return all artists
export async function GET() {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ artists: DEMO_ARTISTS });
    }

    const artistas = await db.artista.findMany({
      orderBy: { seguidoresCount: 'desc' },
    });

    const artists = artistas.map((a) => ({
      id: a.id,
      name: a.nome,
      avatar_url: a.avatarUrl,
      cover_url: a.coverUrl,
      bio: a.bio,
      genre: a.genero,
      followers_count: a.seguidoresCount,
    }));

    return NextResponse.json({ artists });
  } catch (error) {
    console.error('[ARTISTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar artistas' }, { status: 500 });
  }
}

// POST /api/artists — Create a new artist (authenticated)
export async function POST(request: Request) {
  try {
    // TODO: Add admin authentication check
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { nome, avatarUrl, coverUrl, bio, genero } = await request.json();

    if (!nome) {
      return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 });
    }

    const artista = await db.artista.create({
      data: {
        nome,
        avatarUrl: avatarUrl || null,
        coverUrl: coverUrl || null,
        bio: bio || '',
        genero: genero || '',
      },
    });

    return NextResponse.json({
      id: artista.id,
      name: artista.nome,
      avatar_url: artista.avatarUrl,
      cover_url: artista.coverUrl,
      bio: artista.bio,
      genre: artista.genero,
      followers_count: artista.seguidoresCount,
    }, { status: 201 });
  } catch (error) {
    console.error('[ARTISTS POST]', error);
    return NextResponse.json({ error: 'Erro ao criar artista' }, { status: 500 });
  }
}

// PATCH /api/artists — Update an existing artist's profile (name, bio, genre, images)
export async function PATCH(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { id, nome, avatarUrl, coverUrl, bio, genero } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const existing = await db.artista.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 });
    }

    const artista = await db.artista.update({
      where: { id },
      data: {
        ...(nome !== undefined ? { nome } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(coverUrl !== undefined ? { coverUrl } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(genero !== undefined ? { genero } : {}),
      },
    });

    return NextResponse.json({
      id: artista.id,
      name: artista.nome,
      avatar_url: artista.avatarUrl,
      cover_url: artista.coverUrl,
      bio: artista.bio,
      genre: artista.genero,
      followers_count: artista.seguidoresCount,
    });
  } catch (error) {
    console.error('[ARTISTS PATCH]', error);
    return NextResponse.json({ error: 'Erro ao atualizar artista' }, { status: 500 });
  }
}
