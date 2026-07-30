import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// GET /api/users?id=xxx       -> perfil público de UM usuário (nome, foto,
//                                 artistas que ele criou, seguidores/seguindo).
//                                 Não exige login: é uma vitrine pública.
//                                 Se houver token de autenticação, retorna
//                                 também `is_following` (se o viewer segue
//                                 esse usuário).
// GET /api/users?search=xxx   -> Busca usuários por nome/email (autenticado).
// PATCH /api/users            -> Atualiza perfil do usuário logado (nome, avatar_url).
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
          seguidoresCount: true,
          seguindoCount: true,
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

      // Verifica se quem está vendo o perfil segue esse usuário
      let isFollowing: boolean | null = null;
      const viewerId = await authenticateRequest(request);
      if (viewerId && viewerId !== id) {
        const relation = await db.seguirUsuario.findUnique({
          where: {
            seguidorId_seguidoId: {
              seguidorId: viewerId,
              seguidoId: id,
            },
          },
        });
        isFollowing = !!relation;
      }

      return NextResponse.json({
        user: {
          id: usuario.id,
          name: usuario.name,
          avatar_url: usuario.avatarUrl,
          last_seen_at: usuario.lastSeenAt?.toISOString() ?? null,
          created_at: usuario.createdAt.toISOString(),
          followers_count: usuario.seguidoresCount,
          following_count: usuario.seguindoCount,
          is_following: isFollowing,
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
      return NextResponse.json({ users: [] });
    }

    const usuarios = await db.usuario.findMany({
      where: {
        id: { not: userId },
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
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

// PATCH /api/users
// Atualiza o perfil do usuário logado (nome e/ou avatar_url).
export async function PATCH(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Banco de dados não configurado' }, { status: 503 });
    }

    const body = await request.json();
    const { name, avatar_url } = body;

    // Monta o objeto de atualização só com os campos enviados
    const data: { name?: string; avatarUrl?: string | null } = {};
    if (typeof name === 'string' && name.trim().length > 0) {
      data.name = name.trim().slice(0, 100);
    }
    if (avatar_url !== undefined) {
      data.avatarUrl = avatar_url === '' ? null : avatar_url;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const updated = await db.usuario.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, avatarUrl: true, email: true },
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        avatar_url: updated.avatarUrl,
      },
    });
  } catch (error) {
    console.error('[USERS PATCH]', error);
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}
