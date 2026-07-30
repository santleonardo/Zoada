import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// GET /api/users?search=xxx — Busca usuários por nome/email (autenticado).
// Usado na tela de "nova conversa": sem essa rota não há como descobrir o
// id de outra pessoa pra começar a primeira mensagem com ela.
export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
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
