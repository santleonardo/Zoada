import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { notDeleted } from '@/lib/soft-delete';

// Formata um clube (com contagem de membros e, opcionalmente, o papel do
// usuário logado nele) no formato que o frontend espera. `senhaHash` NUNCA
// sai daqui — só um booleano dizendo se o clube tem senha de entrada.
function formatClub(c: {
  id: string;
  nome: string;
  descricao: string | null;
  capaUrl: string | null;
  criadorId: string;
  createdAt: Date;
  senhaHash?: string | null;
  _count?: { membros: number };
  membros?: { papel: string }[];
}) {
  return {
    id: c.id,
    name: c.nome,
    description: c.descricao,
    cover_url: c.capaUrl,
    creator_id: c.criadorId,
    created_at: c.createdAt.toISOString(),
    members_count: c._count?.membros ?? 0,
    my_role: c.membros && c.membros.length > 0 ? c.membros[0].papel : null,
    has_password: !!c.senhaHash,
  };
}

// GET /api/clubs — Lista os clubes existentes, mais recentes primeiro.
// Público (não exige login) — quem visitar sem estar autenticado só não
// recebe `my_role` preenchido. Aceita ?mine=1 para listar só os clubes
// dos quais o usuário logado é membro (admin ou não).
export async function GET(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ clubs: [] });
    }

    const { searchParams } = new URL(request.url);
    const mine = searchParams.get('mine') === '1';
    const viewerId = await authenticateRequest(request);

    if (mine && !viewerId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const meWhere = { usuarioId: viewerId || '__sem_usuario__' };

    const clubes = await db.clube.findMany({
      where: {
        ...notDeleted,
        ...(mine ? { membros: { some: { usuarioId: viewerId as string } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { membros: true } },
        membros: { where: meWhere, select: { papel: true } },
      },
    });

    return NextResponse.json({ clubs: clubes.map(formatClub) });
  } catch (error) {
    console.error('[CLUBS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar clubes' }, { status: 500 });
  }
}

// POST /api/clubs — Cria um clube novo. Quem cria vira automaticamente o
// admin dele (entra como MembroClube com papel ADMIN).
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { name, description } = await request.json();
    const trimmedName = typeof name === 'string' ? name.trim().slice(0, 60) : '';
    const trimmedDescription =
      typeof description === 'string' ? description.trim().slice(0, 280) : '';

    if (!trimmedName) {
      return NextResponse.json({ error: 'O clube precisa de um nome' }, { status: 400 });
    }

    const clube = await db.clube.create({
      data: {
        nome: trimmedName,
        descricao: trimmedDescription || null,
        criadorId: userId,
        membros: {
          create: { usuarioId: userId, papel: 'ADMIN' },
        },
      },
      include: {
        _count: { select: { membros: true } },
        membros: { where: { usuarioId: userId }, select: { papel: true } },
      },
    });

    return NextResponse.json({ club: formatClub(clube) }, { status: 201 });
  } catch (error) {
    console.error('[CLUBS POST]', error);
    return NextResponse.json({ error: 'Erro ao criar clube' }, { status: 500 });
  }
}

// PATCH /api/clubs — Edita nome, descrição (bio), foto de capa e/ou senha
// de entrada de um clube já existente. Só o admin do clube pode editar.
// Campos omitidos (undefined) ficam como estavam; `null`/'' em cover_url
// ou password limpa a capa/senha (clube volta a ser aberto).
export async function PATCH(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { club_id, name, description, cover_url, password } = await request.json();
    if (!club_id) {
      return NextResponse.json({ error: 'club_id é obrigatório' }, { status: 400 });
    }

    const meuVinculo = await db.membroClube.findUnique({
      where: { clubeId_usuarioId: { clubeId: club_id, usuarioId: userId } },
    });
    if (!meuVinculo || meuVinculo.papel !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Só o admin do clube pode editar' },
        { status: 403 }
      );
    }

    const data: {
      nome?: string;
      descricao?: string | null;
      capaUrl?: string | null;
      senhaHash?: string | null;
    } = {};

    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim().slice(0, 60) : '';
      if (!trimmedName) {
        return NextResponse.json({ error: 'O clube precisa de um nome' }, { status: 400 });
      }
      data.nome = trimmedName;
    }

    if (description !== undefined) {
      const trimmedDescription =
        typeof description === 'string' ? description.trim().slice(0, 280) : '';
      data.descricao = trimmedDescription || null;
    }

    if (cover_url !== undefined) {
      data.capaUrl = typeof cover_url === 'string' && cover_url.trim() ? cover_url.trim() : null;
    }

    // password: string não-vazia define/troca a senha; '' ou null remove
    // (clube volta a ser aberto, qualquer um entra sem senha).
    if (password !== undefined) {
      const trimmedPassword = typeof password === 'string' ? password.trim() : '';
      if (!trimmedPassword) {
        data.senhaHash = null;
      } else if (trimmedPassword.length < 4) {
        return NextResponse.json(
          { error: 'A senha precisa ter pelo menos 4 caracteres' },
          { status: 400 }
        );
      } else {
        data.senhaHash = await bcrypt.hash(trimmedPassword, 10);
      }
    }

    const clube = await db.clube.update({
      where: { id: club_id },
      data,
      include: {
        _count: { select: { membros: true } },
        membros: { where: { usuarioId: userId }, select: { papel: true } },
      },
    });

    return NextResponse.json({ club: formatClub(clube) });
  } catch (error) {
    console.error('[CLUBS PATCH]', error);
    return NextResponse.json({ error: 'Erro ao editar clube' }, { status: 500 });
  }
}
