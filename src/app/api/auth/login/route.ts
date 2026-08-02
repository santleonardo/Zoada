import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createToken, buildUserResponse } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { isExpired } from '@/lib/soft-delete';

// POST /api/auth/login
// Login with email/password — Neon Postgres + JWT
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    // If Neon is not configured, return demo mode
    if (!isNeonConfigured) {
      return NextResponse.json({
        error: 'Neon não configurado. Use o demo login.',
        demo: true,
      }, { status: 503 });
    }

    // Find user by email
    const user = await db.usuario.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });
    }

    // Conta apagada (soft-delete) há mais de 30 dias: trata como se não
    // existisse mais — o job de limpeza vai varrer os dados de vez em
    // breve, se ainda não o fez.
    if (user.deletedAt && isExpired(user.deletedAt)) {
      return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });
    }

    // Conta apagada dentro dos últimos 30 dias: a senha certa dentro do
    // prazo é o próprio "desfazer" a exclusão — restaura a conta e tudo
    // que foi apagado junto (artistas, faixas, estação, postagens).
    let restored = false;
    if (user.deletedAt) {
      await db.$transaction([
        db.usuario.update({ where: { id: user.id }, data: { deletedAt: null } }),
        db.artista.updateMany({ where: { usuarioId: user.id, deletedAt: user.deletedAt }, data: { deletedAt: null } }),
        db.faixa.updateMany({ where: { artista: { usuarioId: user.id }, deletedAt: user.deletedAt }, data: { deletedAt: null } }),
        db.estacaoRadio.updateMany({ where: { usuarioId: user.id, deletedAt: user.deletedAt }, data: { deletedAt: null } }),
        db.postagem.updateMany({ where: { usuarioId: user.id, deletedAt: user.deletedAt }, data: { deletedAt: null } }),
      ]);
      restored = true;
    }

    // Generate JWT
    const token = await createToken({ userId: user.id, email: user.email });

    return NextResponse.json({ ...buildUserResponse(user, token), restored });
  } catch (error) {
    console.error('[LOGIN]', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
