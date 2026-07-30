import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { isOnline } from '@/lib/presence';

// POST /api/presence — Heartbeat: marca o usuário logado como "visto agora".
// O client chama isso periodicamente enquanto o app está aberto (ver
// sendHeartbeat em src/lib/api.ts). Sem chamadas recentes, o usuário
// simplesmente para de aparecer como online — não precisa de "logout"
// explícito de presença.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ ok: true, last_seen_at: new Date().toISOString() });
    }

    const usuario = await db.usuario.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
      select: { lastSeenAt: true },
    });

    return NextResponse.json({ ok: true, last_seen_at: usuario.lastSeenAt?.toISOString() ?? null });
  } catch (error) {
    console.error('[PRESENCE POST]', error);
    return NextResponse.json({ error: 'Erro ao registrar presença' }, { status: 500 });
  }
}

// GET /api/presence?user_ids=id1,id2,id3 — Status de presença de um ou
// mais usuários (autenticado, pra não expor isso publicamente).
export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('user_ids') || '';
    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ presence: {} });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ presence: {} });
    }

    const usuarios = await db.usuario.findMany({
      where: { id: { in: ids } },
      select: { id: true, lastSeenAt: true },
    });

    const presence: Record<string, { online: boolean; last_seen_at: string | null }> = {};
    for (const u of usuarios) {
      presence[u.id] = {
        online: isOnline(u.lastSeenAt),
        last_seen_at: u.lastSeenAt?.toISOString() ?? null,
      };
    }

    return NextResponse.json({ presence });
  } catch (error) {
    console.error('[PRESENCE GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar presença' }, { status: 500 });
  }
}
