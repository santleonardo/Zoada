import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createToken, buildUserResponse } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { isExpired } from '@/lib/soft-delete';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

// POST /api/auth/register
// Register new user — Neon Postgres + JWT
export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    // No máximo 10 contas novas por IP a cada 15 minutos — dificulta
    // criação em massa de contas (spam, abuso do painel de moderação, etc).
    const rl = checkRateLimit(`register:${getClientIp(request)}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado. Defina NEON_DATABASE_URL no .env' }, { status: 503 });
    }

    // Check if user already exists. Enquanto uma conta soft-deletada não
    // for varrida pelo job de limpeza (até 30 dias), o email dela continua
    // "ocupado" — é assim que a exclusão continua desfazível fazendo
    // login de novo com a senha antiga.
    const existing = await db.usuario.findUnique({ where: { email } });
    if (existing && existing.deletedAt && !isExpired(existing.deletedAt)) {
      return NextResponse.json(
        { error: 'Este email tem uma conta apagada recentemente. Faça login com a senha antiga para restaurá-la.' },
        { status: 409 }
      );
    }
    if (existing && (!existing.deletedAt || isExpired(existing.deletedAt))) {
      return NextResponse.json({ error: 'Este email já está cadastrado' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await db.usuario.create({
      data: {
        email,
        name: name || email.split('@')[0],
        passwordHash,
      },
    });

    // Generate JWT
    const token = await createToken({ userId: user.id, email: user.email });

    return NextResponse.json(buildUserResponse(user, token), { status: 201 });
  } catch (error) {
    console.error('[REGISTER]', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
