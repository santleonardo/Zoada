import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createToken, buildUserResponse } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

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

    // Generate JWT
    const token = await createToken({ userId: user.id, email: user.email });

    return NextResponse.json(buildUserResponse(user, token));
  } catch (error) {
    console.error('[LOGIN]', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
