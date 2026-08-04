import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MODERATION_SECRET, isNeonConfigured } from '@/lib/config';
import { isValidBearerSecret } from '@/lib/rateLimit';
import { invalidateSuspensaoCache } from '@/lib/auth';

// ============================================================
// /api/moderacao/suspensoes — Suspender/reativar o acesso de um usuário
// à plataforma, direto pelo painel de moderação (public/moderacao/index.html).
//
// Uma suspensão apenas grava `suspenso_ate` (até quando) e `suspenso_motivo`
// (opcional) na própria linha do usuário — nada de tabela separada, então
// reativar é só limpar os dois campos. Enquanto `suspenso_ate` estiver no
// futuro:
//   - o usuário não consegue logar (ver POST /api/auth/login)
//   - tokens já emitidos param de funcionar (ver authenticateRequest)
// Passado o prazo, a suspensão "expira" sozinha — não precisa de job.
//
// GET    ?q=termo        — busca usuários por nome/email (pra localizar
//                           quem suspender) ou lista os atualmente suspensos
//                           se `q` vier vazio.
// POST   { usuario_id, duracao: '24h' | '7d', motivo? } — suspende.
// DELETE ?usuario_id=xxx — remove a suspensão antes do prazo (reativa).
//
// Autenticação: `Authorization: Bearer <MODERATION_SECRET>`, igual ao
// resto do painel.
// ============================================================

const DURACOES_MS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

function isModerator(request: Request): boolean {
  return isValidBearerSecret(request, MODERATION_SECRET);
}

function formatUsuario(u: {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  suspensoAte: Date | null;
  suspensoMotivo: string | null;
}) {
  const suspenso = !!(u.suspensoAte && u.suspensoAte.getTime() > Date.now());
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatar_url: u.avatarUrl,
    suspenso,
    suspenso_ate: u.suspensoAte ? u.suspensoAte.toISOString() : null,
    suspenso_motivo: u.suspensoMotivo,
  };
}

// GET /api/moderacao/suspensoes?q=termo — busca por nome/email (até 20
// resultados). Sem `q`, lista quem está suspenso agora.
export async function GET(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ users: [] });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    const usuarios = q
      ? await db.usuario.findMany({
          where: {
            OR: [
              { id: q },
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
          orderBy: { name: 'asc' },
          take: 20,
          select: { id: true, name: true, email: true, avatarUrl: true, suspensoAte: true, suspensoMotivo: true },
        })
      : await db.usuario.findMany({
          where: { suspensoAte: { gt: new Date() } },
          orderBy: { suspensoAte: 'desc' },
          take: 100,
          select: { id: true, name: true, email: true, avatarUrl: true, suspensoAte: true, suspensoMotivo: true },
        });

    return NextResponse.json({ users: usuarios.map(formatUsuario) });
  } catch (error) {
    console.error('[MODERACAO SUSPENSOES GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
  }
}

// POST /api/moderacao/suspensoes  body: { usuario_id, duracao: '24h' | '7d', motivo? }
export async function POST(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const usuarioId = typeof body.usuario_id === 'string' ? body.usuario_id : '';
    const duracao = typeof body.duracao === 'string' ? body.duracao : '';
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim().slice(0, 300) || null : null;

    if (!usuarioId) {
      return NextResponse.json({ error: 'usuario_id é obrigatório' }, { status: 400 });
    }
    if (!DURACOES_MS[duracao]) {
      return NextResponse.json({ error: "duracao inválida — use '24h' ou '7d'" }, { status: 400 });
    }

    const existente = await db.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
    if (!existente) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const suspensoAte = new Date(Date.now() + DURACOES_MS[duracao]);

    const usuario = await db.usuario.update({
      where: { id: usuarioId },
      data: { suspensoAte, suspensoMotivo: motivo },
      select: { id: true, name: true, email: true, avatarUrl: true, suspensoAte: true, suspensoMotivo: true },
    });

    // Sem isso, um token já emitido pra esse usuário continuaria valendo
    // por até 15s (TTL do cache em authenticateRequest) mesmo depois de
    // suspenso.
    invalidateSuspensaoCache(usuarioId);

    return NextResponse.json({ user: formatUsuario(usuario) }, { status: 201 });
  } catch (error) {
    console.error('[MODERACAO SUSPENSOES POST]', error);
    return NextResponse.json({ error: 'Erro ao suspender usuário' }, { status: 500 });
  }
}

// DELETE /api/moderacao/suspensoes?usuario_id=xxx — remove a suspensão
// antes do prazo terminar (reativa o acesso na hora).
export async function DELETE(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get('usuario_id') || '';
    if (!usuarioId) {
      return NextResponse.json({ error: 'usuario_id é obrigatório' }, { status: 400 });
    }

    const existente = await db.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
    if (!existente) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    await db.usuario.update({
      where: { id: usuarioId },
      data: { suspensoAte: null, suspensoMotivo: null },
    });

    invalidateSuspensaoCache(usuarioId);

    return NextResponse.json({ reactivated: true });
  } catch (error) {
    console.error('[MODERACAO SUSPENSOES DELETE]', error);
    return NextResponse.json({ error: 'Erro ao reativar usuário' }, { status: 500 });
  }
}
