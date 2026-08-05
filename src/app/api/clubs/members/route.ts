import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { notDeleted } from '@/lib/soft-delete';

function formatMember(m: {
  id: string;
  usuarioId: string;
  papel: string;
  createdAt: Date;
  usuario: { id: string; name: string; avatarUrl: string | null };
}) {
  return {
    id: m.id,
    user_id: m.usuarioId,
    name: m.usuario.name,
    avatar_url: m.usuario.avatarUrl,
    role: m.papel,
    joined_at: m.createdAt.toISOString(),
  };
}

// GET /api/clubs/members?club_id=xxx — Lista os membros de um clube, com
// os admins primeiro. Só membros do próprio clube podem ver a lista.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubeId = searchParams.get('club_id');
    if (!clubeId) {
      return NextResponse.json({ error: 'club_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ members: [] });
    }

    const viewerId = await authenticateRequest(request);
    if (!viewerId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const souMembro = await db.membroClube.findUnique({
      where: { clubeId_usuarioId: { clubeId, usuarioId: viewerId } },
    });
    if (!souMembro) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const membros = await db.membroClube.findMany({
      where: { clubeId, usuario: { ...notDeleted } },
      orderBy: [{ papel: 'asc' }, { createdAt: 'asc' }],
      include: { usuario: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return NextResponse.json({ members: membros.map(formatMember) });
  } catch (error) {
    console.error('[CLUB MEMBERS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar membros' }, { status: 500 });
  }
}

// POST /api/clubs/members — Convida (adiciona diretamente) um usuário a
// um clube. Só o admin do clube pode convidar.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { club_id, user_id } = await request.json();
    if (!club_id || !user_id) {
      return NextResponse.json({ error: 'club_id e user_id são obrigatórios' }, { status: 400 });
    }

    const meuVinculo = await db.membroClube.findUnique({
      where: { clubeId_usuarioId: { clubeId: club_id, usuarioId: userId } },
    });
    if (!meuVinculo || meuVinculo.papel !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Só o admin do clube pode convidar membros' },
        { status: 403 }
      );
    }

    const convidado = await db.usuario.findFirst({
      where: { id: user_id, ...notDeleted },
      select: { id: true },
    });
    if (!convidado) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const jaEhMembro = await db.membroClube.findUnique({
      where: { clubeId_usuarioId: { clubeId: club_id, usuarioId: user_id } },
    });
    if (jaEhMembro) {
      return NextResponse.json({ error: 'Esse fã já faz parte do clube' }, { status: 409 });
    }

    const membro = await db.membroClube.create({
      data: { clubeId: club_id, usuarioId: user_id, papel: 'MEMBRO' },
      include: { usuario: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return NextResponse.json({ member: formatMember(membro) }, { status: 201 });
  } catch (error) {
    console.error('[CLUB MEMBERS POST]', error);
    return NextResponse.json({ error: 'Erro ao convidar membro' }, { status: 500 });
  }
}

// DELETE /api/clubs/members?club_id=xxx&user_id=yyy — Remove um membro do
// clube. O admin pode remover qualquer um (menos ele mesmo, pra nunca
// deixar o clube sem admin); qualquer membro pode remover a si mesmo
// (sair do clube).
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
    const clubeId = searchParams.get('club_id');
    const alvoId = searchParams.get('user_id');
    if (!clubeId || !alvoId) {
      return NextResponse.json({ error: 'club_id e user_id são obrigatórios' }, { status: 400 });
    }

    const meuVinculo = await db.membroClube.findUnique({
      where: { clubeId_usuarioId: { clubeId, usuarioId: userId } },
    });
    if (!meuVinculo) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const souEuMesmo = alvoId === userId;
    if (!souEuMesmo && meuVinculo.papel !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Só o admin do clube pode remover outros membros' },
        { status: 403 }
      );
    }
    if (souEuMesmo && meuVinculo.papel === 'ADMIN') {
      return NextResponse.json(
        { error: 'O admin não pode sair do próprio clube' },
        { status: 409 }
      );
    }

    await db.membroClube.delete({
      where: { clubeId_usuarioId: { clubeId, usuarioId: alvoId } },
    });

    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error('[CLUB MEMBERS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao remover membro' }, { status: 500 });
  }
}
