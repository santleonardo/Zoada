import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createToken, buildUserResponse } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { isExpired } from '@/lib/soft-delete';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

// POST /api/auth/login
// Login with email/password — Neon Postgres + JWT
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    // No máximo 10 tentativas de login por IP a cada 5 minutos — trava
    // força bruta de senha sem atrapalhar alguém que só errou a senha
    // algumas vezes. Chave combina IP + email pra não deixar um único IP
    // "gastar" o limite de todo mundo tentando um monte de emails.
    const rl = checkRateLimit(`login:${getClientIp(request)}:${String(email).toLowerCase()}`, 10, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
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

    // Conta suspensa pela moderação: bloqueia o login enquanto durar,
    // avisando até quando (senha continua certa, então dá pra diferenciar
    // de "email ou senha incorretos").
    if (user.suspensoAte && user.suspensoAte.getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: 'Conta suspensa',
          suspended: true,
          suspended_until: user.suspensoAte.toISOString(),
          suspended_reason: user.suspensoMotivo || null,
        },
        { status: 403 }
      );
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
