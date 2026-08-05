import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
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

// POST /api/clubs/join — Qualquer usuário logado pode entrar sozinho num
// clube (sem precisar de convite do admin). Se o clube tiver senha de
// entrada definida, a senha enviada precisa bater; se não tiver, o clube
// é aberto e qualquer um entra direto.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { club_id, password } = await request.json();
    if (!club_id) {
      return NextResponse.json({ error: 'club_id é obrigatório' }, { status: 400 });
    }

    const clube = await db.clube.findFirst({ where: { id: club_id, ...notDeleted } });
    if (!clube) {
      return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 });
    }

    const jaEhMembro = await db.membroClube.findUnique({
      where: { clubeId_usuarioId: { clubeId: club_id, usuarioId: userId } },
    });
    if (jaEhMembro) {
      return NextResponse.json({ error: 'Você já faz parte desse clube' }, { status: 409 });
    }

    if (clube.senhaHash) {
      const senhaEnviada = typeof password === 'string' ? password : '';
      const senhaConfere = senhaEnviada && (await bcrypt.compare(senhaEnviada, clube.senhaHash));
      if (!senhaConfere) {
        return NextResponse.json({ error: 'Senha incorreta' }, { status: 403 });
      }
    }

    const membro = await db.membroClube.create({
      data: { clubeId: club_id, usuarioId: userId, papel: 'MEMBRO' },
      include: { usuario: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return NextResponse.json({ member: formatMember(membro) }, { status: 201 });
  } catch (error) {
    console.error('[CLUBS JOIN]', error);
    return NextResponse.json({ error: 'Erro ao entrar no clube' }, { status: 500 });
  }
}
