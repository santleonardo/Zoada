import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured, MODERATION_SECRET } from '@/lib/config';
import { isValidBearerSecret } from '@/lib/rateLimit';

// ============================================================
// /api/reports — Canal de denúncia (Marco Civil, pós-decisão do STF de
// jun/2025, Temas 533 e 987). Qualquer usuário logado pode denunciar uma
// postagem, comentário, faixa ou perfil. O painel de moderação, que fica
// em public/moderacao/index.html (fora do app, como pedido), lê e resolve
// essas denúncias por aqui usando MODERATION_SECRET.
// ============================================================

const TIPOS_VALIDOS = ['POSTAGEM', 'COMENTARIO_POSTAGEM', 'COMENTARIO_FAIXA', 'FAIXA', 'USUARIO'] as const;
type TipoAlvo = (typeof TIPOS_VALIDOS)[number];

const STATUS_VALIDOS = ['PENDENTE', 'EM_ANALISE', 'RESOLVIDA', 'REJEITADA'] as const;
type Status = (typeof STATUS_VALIDOS)[number];

// Confere se quem está chamando é o painel de moderação (ou outra
// ferramenta interna) — via header `Authorization: Bearer <MODERATION_SECRET>`.
// Mesmo padrão já usado em /api/cron/purge-deleted com CRON_SECRET.
function isModerator(request: Request): boolean {
  return isValidBearerSecret(request, MODERATION_SECRET);
}

function formatReport(d: {
  id: string;
  tipoAlvo: string;
  alvoId: string;
  motivo: string;
  descricao: string | null;
  conteudoSnapshot: string | null;
  autorSnapshot: string | null;
  autorId: string | null;
  denuncianteId: string | null;
  denunciante?: { id: string; name: string; avatarUrl: string | null } | null;
  status: string;
  notaModeracao: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}) {
  return {
    id: d.id,
    tipo_alvo: d.tipoAlvo,
    alvo_id: d.alvoId,
    motivo: d.motivo,
    descricao: d.descricao,
    conteudo_snapshot: d.conteudoSnapshot,
    autor_snapshot: d.autorSnapshot,
    autor_id: d.autorId,
    denunciante: d.denunciante
      ? { id: d.denunciante.id, name: d.denunciante.name, avatar_url: d.denunciante.avatarUrl }
      : null,
    status: d.status,
    nota_moderacao: d.notaModeracao,
    created_at: d.createdAt.toISOString(),
    resolved_at: d.resolvedAt ? d.resolvedAt.toISOString() : null,
  };
}

// Busca o "retrato" do conteúdo/autor no momento da denúncia, pra o painel
// de moderação ter contexto mesmo que o conteúdo seja apagado depois.
// Trunca o texto pra não guardar coisa gigante numa denúncia.
async function buildSnapshot(
  tipoAlvo: TipoAlvo,
  alvoId: string
): Promise<{ conteudoSnapshot: string | null; autorSnapshot: string | null; autorId: string | null } | null> {
  const truncate = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n)}…` : s);

  switch (tipoAlvo) {
    case 'POSTAGEM': {
      const p = await db.postagem.findUnique({
        where: { id: alvoId },
        include: { usuario: { select: { id: true, name: true } }, faixa: { select: { titulo: true } } },
      });
      if (!p) return null;
      const texto = [p.legenda, p.faixa ? `[faixa: ${p.faixa.titulo}]` : null].filter(Boolean).join(' ');
      return { conteudoSnapshot: texto ? truncate(texto) : null, autorSnapshot: p.usuario.name, autorId: p.usuarioId };
    }
    case 'COMENTARIO_POSTAGEM': {
      const c = await db.comentarioPostagem.findUnique({
        where: { id: alvoId },
        include: { usuario: { select: { id: true, name: true } } },
      });
      if (!c) return null;
      return { conteudoSnapshot: truncate(c.conteudo), autorSnapshot: c.usuario.name, autorId: c.usuarioId };
    }
    case 'COMENTARIO_FAIXA': {
      const c = await db.comentario.findUnique({
        where: { id: alvoId },
        include: { usuario: { select: { id: true, name: true } } },
      });
      if (!c) return null;
      return { conteudoSnapshot: truncate(c.conteudo), autorSnapshot: c.usuario.name, autorId: c.usuarioId };
    }
    case 'FAIXA': {
      const f = await db.faixa.findUnique({ where: { id: alvoId }, include: { artista: { select: { nome: true, usuarioId: true } } } });
      if (!f) return null;
      return {
        conteudoSnapshot: truncate(`${f.titulo} — ${f.artista.nome}`),
        autorSnapshot: f.artista.nome,
        autorId: f.artista.usuarioId,
      };
    }
    case 'USUARIO': {
      const u = await db.usuario.findUnique({ where: { id: alvoId }, select: { id: true, name: true, bio: true } });
      if (!u) return null;
      return { conteudoSnapshot: u.bio ? truncate(u.bio) : null, autorSnapshot: u.name, autorId: u.id };
    }
    default:
      return null;
  }
}

// POST /api/reports — cria uma denúncia. Exige login (evita spam anônimo),
// mas o denunciante nunca aparece para o autor do conteúdo denunciado —
// só o painel de moderação vê quem denunciou.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Entre na sua conta para denunciar' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const tipoAlvo = body.tipo_alvo as TipoAlvo;
    const alvoId = typeof body.alvo_id === 'string' ? body.alvo_id : '';
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim().slice(0, 120) : '';
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim().slice(0, 1000) : null;

    if (!TIPOS_VALIDOS.includes(tipoAlvo)) {
      return NextResponse.json({ error: 'tipo_alvo inválido' }, { status: 400 });
    }
    if (!alvoId) {
      return NextResponse.json({ error: 'alvo_id é obrigatório' }, { status: 400 });
    }
    if (!motivo) {
      return NextResponse.json({ error: 'motivo é obrigatório' }, { status: 400 });
    }

    const snapshot = await buildSnapshot(tipoAlvo, alvoId);
    if (!snapshot) {
      return NextResponse.json({ error: 'Conteúdo denunciado não encontrado' }, { status: 404 });
    }

    const denuncia = await db.denuncia.create({
      data: {
        tipoAlvo,
        alvoId,
        motivo,
        descricao,
        conteudoSnapshot: snapshot.conteudoSnapshot,
        autorSnapshot: snapshot.autorSnapshot,
        autorId: snapshot.autorId,
        denuncianteId: userId,
      },
      include: { denunciante: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return NextResponse.json({ report: formatReport(denuncia) }, { status: 201 });
  } catch (error) {
    console.error('[REPORTS POST]', error);
    return NextResponse.json({ error: 'Erro ao registrar denúncia' }, { status: 500 });
  }
}

// GET /api/reports?status=PENDENTE — lista denúncias para o painel de
// moderação. Só responde com o header de moderador certo.
export async function GET(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ reports: [] });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const tipoAlvo = searchParams.get('tipo_alvo');
    const limitParam = parseInt(searchParams.get('limit') || '', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 100;

    const where: Record<string, unknown> = {};
    if (status && STATUS_VALIDOS.includes(status as Status)) where.status = status;
    if (tipoAlvo && TIPOS_VALIDOS.includes(tipoAlvo as TipoAlvo)) where.tipoAlvo = tipoAlvo;

    const denuncias = await db.denuncia.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { denunciante: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return NextResponse.json({ reports: denuncias.map(formatReport) });
  } catch (error) {
    console.error('[REPORTS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar denúncias' }, { status: 500 });
  }
}

// PATCH /api/reports  body: { id, status, nota_moderacao? } — usado pelo
// painel de moderação para mover uma denúncia entre PENDENTE, EM_ANALISE,
// RESOLVIDA e REJEITADA (com uma nota interna opcional).
export async function PATCH(request: Request) {
  try {
    if (!isModerator(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : '';
    const status = body.status as Status;
    const notaModeracao = typeof body.nota_moderacao === 'string' ? body.nota_moderacao.trim().slice(0, 1000) : undefined;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }
    if (!STATUS_VALIDOS.includes(status)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 });
    }

    const existente = await db.denuncia.findUnique({ where: { id } });
    if (!existente) {
      return NextResponse.json({ error: 'Denúncia não encontrada' }, { status: 404 });
    }

    const denuncia = await db.denuncia.update({
      where: { id },
      data: {
        status,
        ...(notaModeracao !== undefined ? { notaModeracao } : {}),
        resolvedAt: status === 'RESOLVIDA' || status === 'REJEITADA' ? new Date() : null,
      },
      include: { denunciante: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return NextResponse.json({ report: formatReport(denuncia) });
  } catch (error) {
    console.error('[REPORTS PATCH]', error);
    return NextResponse.json({ error: 'Erro ao atualizar denúncia' }, { status: 500 });
  }
}
