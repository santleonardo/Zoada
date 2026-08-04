import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { criarNotificacao } from '@/lib/notifications';

// GET /api/follow-user?follower_id=xxx&followed_id=xxx
// - Os dois juntos: verifica se esse usuário segue esse outro.
// - Só follower_id: lista quem esse usuário segue.
// - Só followed_id: lista quem segue esse usuário (seguidores).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const followerId = searchParams.get('follower_id');
    const followedId = searchParams.get('followed_id');

    if (!isNeonConfigured) {
      if (followerId && followedId) {
        return NextResponse.json({ is_following: false });
      }
      return NextResponse.json({ follows: [] });
    }

    // Checar se segue um usuário específico
    if (followerId && followedId) {
      const exists = await db.seguirUsuario.findUnique({
        where: {
          seguidorId_seguidoId: {
            seguidorId: followerId,
            seguidoId: followedId,
          },
        },
      });
      return NextResponse.json({ is_following: !!exists });
    }

    // Listar quem o usuário segue (following)
    if (followerId) {
      const registros = await db.seguirUsuario.findMany({
        where: { seguidorId: followerId },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({
        follows: registros.map((f) => ({
          id: f.id,
          follower_id: f.seguidorId,
          followed_id: f.seguidoId,
          created_at: f.createdAt.toISOString(),
        })),
      });
    }

    // Listar seguidores de um usuário
    if (followedId) {
      const registros = await db.seguirUsuario.findMany({
        where: { seguidoId: followedId },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({
        follows: registros.map((f) => ({
          id: f.id,
          follower_id: f.seguidorId,
          followed_id: f.seguidoId,
          created_at: f.createdAt.toISOString(),
        })),
      });
    }

    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  } catch (error) {
    console.error('[FOLLOW-USER GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar seguidores' }, { status: 500 });
  }
}

// POST /api/follow-user — Toggle seguir/deixar de seguir um usuário (autenticado).
// Além de criar/apagar o registro de relação, mantém os contadores
// `seguidoresCount` e `seguindoCount` em sincronia.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { followed_id } = await request.json();
    if (!followed_id) {
      return NextResponse.json({ error: 'followed_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ message: 'Neon não configurado' }, { status: 503 });
    }

    // Não pode seguir a si mesmo
    if (userId === followed_id) {
      return NextResponse.json({ error: 'Você não pode seguir a si mesmo' }, { status: 400 });
    }

    const followedUser = await db.usuario.findUnique({ where: { id: followed_id } });
    if (!followedUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const existing = await db.seguirUsuario.findUnique({
      where: {
        seguidorId_seguidoId: {
          seguidorId: userId,
          seguidoId: followed_id,
        },
      },
    });

    if (existing) {
      // Deixar de seguir
      const [, followedUpdated, followerUpdated] = await db.$transaction([
        db.seguirUsuario.delete({ where: { id: existing.id } }),
        db.usuario.update({
          where: { id: followed_id },
          data: { seguidoresCount: { decrement: 1 } },
        }),
        db.usuario.update({
          where: { id: userId },
          data: { seguindoCount: { decrement: 1 } },
        }),
      ]);

      return NextResponse.json({
        following: false,
        followers_count: Math.max(0, followedUpdated.seguidoresCount),
        following_count: Math.max(0, followerUpdated.seguindoCount),
      });
    }

    // Seguir
    const [seguindo, followedUpdated, followerUpdated] = await db.$transaction([
      db.seguirUsuario.create({
        data: {
          seguidorId: userId,
          seguidoId: followed_id,
        },
      }),
      db.usuario.update({
        where: { id: followed_id },
        data: { seguidoresCount: { increment: 1 } },
      }),
      db.usuario.update({
        where: { id: userId },
        data: { seguindoCount: { increment: 1 } },
      }),
    ]);

    // Avisa quem foi seguido (não bloqueia a resposta por causa disso).
    await criarNotificacao({
      usuarioId: followed_id,
      atorId: userId,
      tipo: 'SEGUIDOR',
    });

    return NextResponse.json({
      following: true,
      followers_count: followedUpdated.seguidoresCount,
      following_count: followerUpdated.seguindoCount,
      follow: {
        id: seguindo.id,
        follower_id: seguindo.seguidorId,
        followed_id: seguindo.seguidoId,
        created_at: seguindo.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[FOLLOW-USER POST]', error);
    return NextResponse.json({ error: 'Erro ao processar seguir usuário' }, { status: 500 });
  }
}
