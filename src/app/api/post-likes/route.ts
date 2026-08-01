import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// POST /api/post-likes — Reage (ou remove a reação) de coração na
// postagem em si (o OP que inicia a thread, aba "Fãs"). Toggle: se já
// tinha reagido, remove; senão, cria. Autenticado.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { post_id } = await request.json();
    if (!post_id) {
      return NextResponse.json({ error: 'post_id é obrigatório' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ message: 'Neon não configurado' }, { status: 503 });
    }

    const postagem = await db.postagem.findUnique({ where: { id: post_id }, select: { id: true } });
    if (!postagem) {
      return NextResponse.json({ error: 'Postagem não encontrada' }, { status: 404 });
    }

    const existing = await db.curtidaPostagem.findUnique({
      where: {
        usuarioId_postagemId: {
          usuarioId: userId,
          postagemId: post_id,
        },
      },
    });

    if (existing) {
      await db.curtidaPostagem.delete({ where: { id: existing.id } });
    } else {
      await db.curtidaPostagem.create({
        data: { usuarioId: userId, postagemId: post_id },
      });
    }

    const likesCount = await db.curtidaPostagem.count({ where: { postagemId: post_id } });

    return NextResponse.json({ liked: !existing, likes_count: likesCount });
  } catch (error) {
    console.error('[POST LIKES POST]', error);
    return NextResponse.json({ error: 'Erro ao reagir à postagem' }, { status: 500 });
  }
}
