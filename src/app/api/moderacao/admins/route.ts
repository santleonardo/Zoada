import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MODERATION_SECRET, MODERATION_ADMIN_EMAILS, isNeonConfigured } from '@/lib/config';

// ============================================================
// /api/moderacao/admins — Gerencia quem pode entrar no painel de
// moderação (usado pelo botão "Convidar admin" em public/moderacao).
//
// GET    — lista os admins atuais: os fixos (via env var
//          MODERATION_ADMIN_EMAILS, não removíveis por aqui) e os
//          convidados pelo próprio painel (tabela AdminModeracao).
// POST   — convida um novo admin por email. Precisa já ser uma conta
//          cadastrada no app (tabela Usuario) — não dá pra convidar quem
//          nunca criou conta.
// DELETE — remove um admin convidado (não afeta os fixos via env var).
//
// Autenticação: `Authorization: Bearer <MODERATION_SECRET>`, igual ao
// resto do painel — só quem já está dentro pode convidar/remover outros.
// ============================================================

function isModerator(request: Request): boolean {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${MODERATION_SECRET}`;
}

// GET /api/moderacao/admins
export async function GET(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({
        admins: MODERATION_ADMIN_EMAILS.map((email) => ({ email, source: 'env', name: null })),
      });
    }

    const convidados = await db.adminModeracao.findMany({ orderBy: { createdAt: 'asc' } });

    // Busca o nome de cada admin (fixo ou convidado) na tabela de
    // usuários pra mostrar algo mais amigável que só o email na lista.
    const todosEmails = [...MODERATION_ADMIN_EMAILS, ...convidados.map((c) => c.email.toLowerCase())];
    const usuarios = await db.usuario.findMany({
      where: { email: { in: [...new Set(todosEmails)], mode: 'insensitive' } },
      select: { email: true, name: true },
    });
    const nomeByEmail = new Map(usuarios.map((u) => [u.email.toLowerCase(), u.name]));

    const admins = [
      ...MODERATION_ADMIN_EMAILS.map((email) => ({
        email,
        source: 'env' as const,
        name: nomeByEmail.get(email) || null,
      })),
      ...convidados.map((c) => ({
        email: c.email,
        source: 'db' as const,
        name: nomeByEmail.get(c.email.toLowerCase()) || null,
      })),
    ];

    return NextResponse.json({ admins });
  } catch (error) {
    console.error('[MODERACAO ADMINS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar admins' }, { status: 500 });
  }
}

// POST /api/moderacao/admins  body: { email } — convida um admin novo.
export async function POST(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) {
      return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 });
    }

    // Precisa já ser uma conta cadastrada no app — não criamos conta
    // nenhuma aqui, só liberamos acesso a uma que já existe.
    const usuario = await db.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    });
    if (!usuario) {
      return NextResponse.json(
        { error: 'Esse email precisa ter uma conta cadastrada no app antes de virar admin' },
        { status: 404 }
      );
    }

    if (MODERATION_ADMIN_EMAILS.includes(usuario.email.trim().toLowerCase())) {
      return NextResponse.json({ error: 'Esse email já é admin (fixo por configuração do servidor)' }, { status: 409 });
    }

    const jaConvidado = await db.adminModeracao.findFirst({
      where: { email: { equals: usuario.email, mode: 'insensitive' } },
    });
    if (jaConvidado) {
      return NextResponse.json({ error: 'Esse email já é admin do painel' }, { status: 409 });
    }

    const admin = await db.adminModeracao.create({ data: { email: usuario.email } });

    return NextResponse.json(
      { admin: { email: admin.email, source: 'db', name: usuario.name || null } },
      { status: 201 }
    );
  } catch (error) {
    console.error('[MODERACAO ADMINS POST]', error);
    return NextResponse.json({ error: 'Erro ao convidar admin' }, { status: 500 });
  }
}

// DELETE /api/moderacao/admins?email=xxx — remove um admin convidado
// (os fixos via env var não podem ser removidos por aqui).
export async function DELETE(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const email = (searchParams.get('email') || '').trim();
    if (!email) {
      return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 });
    }

    if (MODERATION_ADMIN_EMAILS.includes(email.toLowerCase())) {
      return NextResponse.json(
        { error: 'Esse admin é fixo por configuração do servidor e não pode ser removido por aqui' },
        { status: 400 }
      );
    }

    const admin = await db.adminModeracao.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!admin) {
      return NextResponse.json({ error: 'Admin não encontrado' }, { status: 404 });
    }

    await db.adminModeracao.delete({ where: { id: admin.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[MODERACAO ADMINS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao remover admin' }, { status: 500 });
  }
}
