import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// GET /api/users?id=xxx       -> perfil público de UM usuário (nome, foto,
//                                 artistas que ele criou). Não exige login:
//                                 é uma vitrine pública, igual ao perfil de
//                                 um artista.
// GET /api/users?search=xxx   -> Busca usuários por nome/email (autenticado).
// Usado na tela de "nova conversa": sem essa rota não há como descobrir o
// id de outra pessoa pra começar a primeira mensagem com ela.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      if (!isNeonConfigured) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      const usuario = await db.usuario.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          lastSeenAt: true,
          createdAt: true,
          artistas: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              nome: true,
              avatarUrl: true,
              coverUrl: true,
              bio: true,
              genero: true,
              seguidoresCount: true,
            },
          },
        },
      });

      if (!usuario) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      return NextResponse.json({
        user: {
          id: usuario.id,
          name: usuario.name,
          avatar_url: usuario.avatarUrl,
          last_seen_at: usuario.lastSeenAt?.toISOString() ?? null,
          created_at: usuario.createdAt.toISOString(),
          artists: usuario.artistas.map((a) => ({
            id: a.id,
            user_id: id,
            name: a.nome,
            avatar_url: a.avatarUrl,
            cover_url: a.coverUrl,
            bio: a.bio,
            genre: a.genero,
            followers_count: a.seguidoresCount,
          })),
        },
      });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const search = (searchParams.get('search') || '').trim();

    if (!search) {
      return NextResponse.json({ users: [] });
    }

    if (!isNeonConfigured) {
      // Sem banco configurado não há usuários reais pra buscar.
      return NextResponse.json({ users: [] });
    }

    const usuarios = await db.usuario.findMany({
      where: {
        id: { not: userId }, // não retorna o próprio usuário logado
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: 'asc' },
      take: 20,
    });

    const users = usuarios.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatar_url: u.avatarUrl,
      created_at: '',
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('[USERS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
  }
}
