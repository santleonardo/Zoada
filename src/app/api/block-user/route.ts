import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// GET /api/block-user?other_id=xxx
//   -> status do bloqueio entre o usuário logado e `other_id`:
//      { i_blocked, blocked_by } (ambos booleanos, direções independentes)
// GET /api/block-user (sem other_id)
//   -> lista de usuários que o usuário logado bloqueou (pra tela de
//      "Usuários bloqueados" nas configurações)
export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ i_blocked: false, blocked_by: false, blocked: [] });
    }

    const { searchParams } = new URL(request.url);
    const otherId = searchParams.get('other_id');

    if (otherId) {
      const [meBloqueiEle, eleMeBloqueou] = await Promise.all([
        db.bloqueio.findUnique({
          where: { bloqueadorId_bloqueadoId: { bloqueadorId: userId, bloqueadoId: otherId } },
        }),
        db.bloqueio.findUnique({
          where: { bloqueadorId_bloqueadoId: { bloqueadorId: otherId, bloqueadoId: userId } },
        }),
      ]);

      return NextResponse.json({
        i_blocked: !!meBloqueiEle,
        blocked_by: !!eleMeBloqueou,
      });
    }

    // Lista de bloqueados pelo usuário logado
    const bloqueios = await db.bloqueio.findMany({
      where: { bloqueadorId: userId },
      include: { bloqueado: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      blocked: bloqueios.map((b) => ({
        id: b.bloqueado.id,
        name: b.bloqueado.name,
        avatar_url: b.bloqueado.avatarUrl,
        blocked_at: b.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[BLOCK-USER GET]', error);
    return NextResponse.json({ error: 'Erro ao verificar bloqueio' }, { status: 500 });
  }
}

// POST /api/block-user — Toggle bloquear/desbloquear um usuário (autenticado).
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { blocked_id } = await request.json();
    if (!blocked_id) {
      return NextResponse.json({ error: 'blocked_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ message: 'Neon não configurado' }, { status: 503 });
    }

    if (userId === blocked_id) {
      return NextResponse.json({ error: 'Você não pode bloquear a si mesmo' }, { status: 400 });
    }

    const alvo = await db.usuario.findUnique({ where: { id: blocked_id } });
    if (!alvo) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const existente = await db.bloqueio.findUnique({
      where: { bloqueadorId_bloqueadoId: { bloqueadorId: userId, bloqueadoId: blocked_id } },
    });

    if (existente) {
      await db.bloqueio.delete({ where: { id: existente.id } });
      return NextResponse.json({ blocked: false });
    }

    // Ao bloquear alguém, também desfaz o "seguir" nos dois sentidos — não
    // faz sentido continuar aparecendo no feed/seguidores de quem você
    // bloqueou (ou continuar seguindo quem te bloqueou). Cada relação
    // desfeita decrementa os contadores das duas contas envolvidas.
    const [euSigoEle, eleMeSegue] = await Promise.all([
      db.seguirUsuario.findUnique({
        where: { seguidorId_seguidoId: { seguidorId: userId, seguidoId: blocked_id } },
      }),
      db.seguirUsuario.findUnique({
        where: { seguidorId_seguidoId: { seguidorId: blocked_id, seguidoId: userId } },
      }),
    ]);

    await db.bloqueio.create({ data: { bloqueadorId: userId, bloqueadoId: blocked_id } });

    if (euSigoEle) {
      await db.$transaction([
        db.seguirUsuario.delete({ where: { id: euSigoEle.id } }),
        db.usuario.update({ where: { id: blocked_id }, data: { seguidoresCount: { decrement: 1 } } }),
        db.usuario.update({ where: { id: userId }, data: { seguindoCount: { decrement: 1 } } }),
      ]);
    }
    if (eleMeSegue) {
      await db.$transaction([
        db.seguirUsuario.delete({ where: { id: eleMeSegue.id } }),
        db.usuario.update({ where: { id: userId }, data: { seguidoresCount: { decrement: 1 } } }),
        db.usuario.update({ where: { id: blocked_id }, data: { seguindoCount: { decrement: 1 } } }),
      ]);
    }

    return NextResponse.json({ blocked: true }, { status: 201 });
  } catch (error) {
    console.error('[BLOCK-USER POST]', error);
    return NextResponse.json({ error: 'Erro ao processar bloqueio' }, { status: 500 });
  }
}
