import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { isNeonConfigured, MODERATION_SECRET } from '@/lib/config';
import { isModerationAdminEmail } from '@/lib/moderation-admins';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

// ============================================================
// /api/moderacao/login — Tela de login do painel de moderação
// (public/moderacao/index.html). Verifica email + senha contra a MESMA
// conta de usuário do app (tabela `Usuario`, igual a /api/auth/login) e,
// se o email estiver na lista de admins (MODERATION_ADMIN_EMAILS), devolve
// a MODERATION_SECRET pro navegador guardar e usar no resto do painel —
// exatamente como se a pessoa tivesse colado a chave manualmente, só que
// agora atrás de um login de verdade em vez de qualquer um com a chave.
//
// Não retorna nada sensível (nem a senha, nem detalhes) se as credenciais
// não baterem ou se o email não for de admin — mensagem genérica nos dois
// casos, pra não dar pista de quais emails têm acesso.
// ============================================================

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json().catch(() => ({}));

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    // Painel de moderação: limite mais rígido (é a porta pra dados
    // sensíveis de denúncias). 5 tentativas a cada 5 minutos por IP+email.
    const rl = checkRateLimit(`mod-login:${getClientIp(request)}:${String(email).toLowerCase()}`, 5, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const trimmedEmail = String(email).trim();

    const user = await db.usuario.findUnique({ where: { email: trimmedEmail } });
    if (!user || !user.passwordHash || user.deletedAt) {
      return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });
    }

    if (!(await isModerationAdminEmail(user.email))) {
      return NextResponse.json(
        { error: 'Esta conta não tem acesso ao painel de moderação' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      secret: MODERATION_SECRET,
      user: { id: user.id, name: user.name, email: user.email, avatar_url: user.avatarUrl },
    });
  } catch (error) {
    console.error('[MODERACAO LOGIN]', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
