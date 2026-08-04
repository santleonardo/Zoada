import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured, MODERATION_SECRET } from '@/lib/config';
import { isValidBearerSecret } from '@/lib/rateLimit';

// ============================================================
// /api/moderacao/mensagens — Canal de mensagens direto entre um usuário e
// a moderação (tipo "fale conosco"), diferente de /api/reports (que é
// sobre denunciar um conteúdo específico). Uma única thread por usuário.
//
// Dois lados batem nessa mesma rota:
//   - o app normal, autenticado como qualquer usuário logado (JWT);
//   - o painel de moderação (public/moderacao/index.html), autenticado
//     via header `Authorization: Bearer <MODERATION_SECRET>`, mesmo
//     padrão usado em /api/reports.
// ============================================================

// Confere se quem está chamando é o painel de moderação.
function isModerator(request: Request): boolean {
  return isValidBearerSecret(request, MODERATION_SECRET);
}

function formatMessage(m: {
  id: string;
  usuarioId: string;
  remetente: string;
  conteudo: string;
  lidaPeloUsuario: boolean;
  lidaPeloModerador: boolean;
  createdAt: Date;
}) {
  return {
    id: m.id,
    usuario_id: m.usuarioId,
    remetente: m.remetente, // 'USUARIO' | 'MODERADOR'
    conteudo: m.conteudo,
    lida_pelo_usuario: m.lidaPeloUsuario,
    lida_pelo_moderador: m.lidaPeloModerador,
    created_at: m.createdAt.toISOString(),
  };
}

// GET /api/moderacao/mensagens
//   - Como usuário logado: retorna a própria thread com a moderação
//     (e marca as mensagens da moderação como lidas).
//   - Como painel de moderação (Bearer MODERATION_SECRET):
//       ?usuario_id=xxx  → retorna a thread completa desse usuário
//                           (e marca as mensagens dele como lidas pelo moderador).
//       sem parâmetro    → retorna a lista de threads (uma por usuário que
//                           já mandou pelo menos uma mensagem), com a
//                           última mensagem e contagem de não lidas.
export async function GET(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ messages: [], threads: [] });
    }

    const { searchParams } = new URL(request.url);
    const usuarioIdParam = searchParams.get('usuario_id');

    if (isModerator(request)) {
      if (usuarioIdParam) {
        const mensagens = await db.mensagemModeracao.findMany({
          where: { usuarioId: usuarioIdParam },
          orderBy: { createdAt: 'asc' },
        });

        await db.mensagemModeracao.updateMany({
          where: { usuarioId: usuarioIdParam, remetente: 'USUARIO', lidaPeloModerador: false },
          data: { lidaPeloModerador: true },
        });

        return NextResponse.json({ messages: mensagens.map(formatMessage) });
      }

      // Lista de threads: agrupa por usuário, pega a última mensagem e
      // conta quantas mensagens do usuário ainda não foram lidas pelo moderador.
      const todas = await db.mensagemModeracao.findMany({
        orderBy: { createdAt: 'desc' },
        include: { usuario: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      });

      const threadMap = new Map<string, {
        usuario: { id: string; name: string; avatar_url: string | null; email: string };
        last_message: ReturnType<typeof formatMessage>;
        unread_count: number;
      }>();

      for (const m of todas) {
        if (!threadMap.has(m.usuarioId)) {
          threadMap.set(m.usuarioId, {
            usuario: {
              id: m.usuario.id,
              name: m.usuario.name,
              avatar_url: m.usuario.avatarUrl,
              email: m.usuario.email,
            },
            last_message: formatMessage(m),
            unread_count: 0,
          });
        }
        if (m.remetente === 'USUARIO' && !m.lidaPeloModerador) {
          threadMap.get(m.usuarioId)!.unread_count++;
        }
      }

      const threads = Array.from(threadMap.values());
      return NextResponse.json({ threads });
    }

    // Lado do usuário comum: precisa estar logado.
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const mensagens = await db.mensagemModeracao.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: 'asc' },
    });

    await db.mensagemModeracao.updateMany({
      where: { usuarioId: userId, remetente: 'MODERADOR', lidaPeloUsuario: false },
      data: { lidaPeloUsuario: true },
    });

    return NextResponse.json({ messages: mensagens.map(formatMessage) });
  } catch (error) {
    console.error('[MODERACAO/MENSAGENS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar mensagens' }, { status: 500 });
  }
}

// POST /api/moderacao/mensagens
//   - Como usuário logado: body { conteudo } → manda uma mensagem para a
//     moderação (na própria thread).
//   - Como painel de moderação: body { usuario_id, conteudo } → responde
//     na thread daquele usuário.
export async function POST(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const conteudo = typeof body.conteudo === 'string' ? body.conteudo.trim().slice(0, 2000) : '';

    if (!conteudo) {
      return NextResponse.json({ error: 'conteudo é obrigatório' }, { status: 400 });
    }

    if (isModerator(request)) {
      const usuarioId = typeof body.usuario_id === 'string' ? body.usuario_id : '';
      if (!usuarioId) {
        return NextResponse.json({ error: 'usuario_id é obrigatório' }, { status: 400 });
      }

      const usuario = await db.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
      if (!usuario) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      const mensagem = await db.mensagemModeracao.create({
        data: {
          usuarioId,
          remetente: 'MODERADOR',
          conteudo,
          lidaPeloModerador: true,
        },
      });

      return NextResponse.json({ message: formatMessage(mensagem) }, { status: 201 });
    }

    // Lado do usuário comum.
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const mensagem = await db.mensagemModeracao.create({
      data: {
        usuarioId: userId,
        remetente: 'USUARIO',
        conteudo,
        lidaPeloUsuario: true,
      },
    });

    return NextResponse.json({ message: formatMessage(mensagem) }, { status: 201 });
  } catch (error) {
    console.error('[MODERACAO/MENSAGENS POST]', error);
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 });
  }
}
