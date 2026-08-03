import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isNeonConfigured, MODERATION_SECRET } from '@/lib/config';

// ============================================================
// /api/aviso — Aviso global disparado pelo painel de moderação
// (public/moderacao/index.html) e mostrado pra todo mundo na tela inicial
// do app (ver MainScreen.tsx). Só existe UM aviso ativo por vez: publicar
// um novo desativa o anterior automaticamente.
//
// GET  — público, qualquer pessoa (logada ou não) pode ler o aviso ativo.
// POST / DELETE — só o painel de moderação, via
// `Authorization: Bearer <MODERATION_SECRET>` (mesmo padrão de /api/reports).
// ============================================================

function isModerator(request: Request): boolean {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${MODERATION_SECRET}`;
}

// GET /api/aviso — retorna o aviso ativo mais recente (ou null se não
// houver nenhum). Sem autenticação: qualquer usuário do app precisa poder
// ler isso pra mostrar o banner.
export async function GET() {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ aviso: null });
    }

    const aviso = await db.aviso.findFirst({
      where: { ativo: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!aviso) {
      return NextResponse.json({ aviso: null });
    }

    return NextResponse.json({
      aviso: {
        id: aviso.id,
        mensagem: aviso.mensagem,
        created_at: aviso.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[AVISO GET]', error);
    return NextResponse.json({ aviso: null });
  }
}

// POST /api/aviso  body: { mensagem } — publica um novo aviso global,
// desativando qualquer aviso anterior (só um fica ativo por vez).
export async function POST(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const mensagem = typeof body.mensagem === 'string' ? body.mensagem.trim().slice(0, 280) : '';

    if (!mensagem) {
      return NextResponse.json({ error: 'mensagem é obrigatória' }, { status: 400 });
    }

    // Desativa qualquer aviso ativo anterior antes de criar o novo — só um
    // banner por vez na tela inicial.
    await db.aviso.updateMany({ where: { ativo: true }, data: { ativo: false } });

    const aviso = await db.aviso.create({
      data: { mensagem, ativo: true },
    });

    return NextResponse.json(
      {
        aviso: {
          id: aviso.id,
          mensagem: aviso.mensagem,
          created_at: aviso.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[AVISO POST]', error);
    return NextResponse.json({ error: 'Erro ao publicar aviso' }, { status: 500 });
  }
}

// DELETE /api/aviso — remove (desativa) o aviso ativo atual, tirando o
// banner da tela inicial de todo mundo.
export async function DELETE(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    await db.aviso.updateMany({ where: { ativo: true }, data: { ativo: false } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[AVISO DELETE]', error);
    return NextResponse.json({ error: 'Erro ao remover aviso' }, { status: 500 });
  }
}
