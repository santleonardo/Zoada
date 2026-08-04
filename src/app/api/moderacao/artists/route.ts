import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MODERATION_SECRET, isNeonConfigured } from '@/lib/config';
import { notDeleted } from '@/lib/soft-delete';
import { isValidBearerSecret } from '@/lib/rateLimit';

function isModerator(request: Request): boolean {
  return isValidBearerSecret(request, MODERATION_SECRET);
}

// GET /api/moderacao/artists — Lista todos os artistas (públicos, não apagados)
// pra o moderador poder selecionar ao enviar uma música.
export async function GET(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ artists: [] });
    }

    const artistas = await db.artista.findMany({
      where: { ...notDeleted },
      orderBy: { nome: 'asc' },
    });

    return NextResponse.json({
      artists: artistas.map((a) => ({
        id: a.id,
        name: a.nome,
        avatar_url: a.avatarUrl,
      })),
    });
  } catch (error) {
    console.error('[MODERACAO ARTISTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar artistas' }, { status: 500 });
  }
}

// POST /api/moderacao/artists — Cria um artista sem dono (pertence ao app),
// usado pela moderação ao enviar músicas oficiais.
export async function POST(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { nome, genero, bio } = await request.json();

    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 });
    }

    const artista = await db.artista.create({
      data: {
        usuarioId: null,
        nome: nome.trim().slice(0, 100),
        bio: bio || '',
        genero: genero || '',
      },
    });

    return NextResponse.json({
      id: artista.id,
      name: artista.nome,
      avatar_url: artista.avatarUrl,
    }, { status: 201 });
  } catch (error) {
    console.error('[MODERACAO ARTISTS POST]', error);
    return NextResponse.json({ error: 'Erro ao criar artista' }, { status: 500 });
  }
}
