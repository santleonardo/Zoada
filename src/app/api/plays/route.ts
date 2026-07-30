import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// GET /api/plays?limit=10 — Top faixas mais ouvidas PELO USUÁRIO LOGADO,
// ordenadas da mais pra menos ouvida (ex: 15x aparece antes de 10x).
// Isso é diferente de faixas.plays_count (que é a contagem global, de
// todo mundo) — aqui é só o hábito de escuta de quem está logado, usado
// na seção "Mais ouvidas" do perfil.
export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ tracks: [] });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 10;

    const reproducoes = await db.reproducao.findMany({
      where: { usuarioId: userId },
      orderBy: [{ vezes: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
      include: {
        faixa: {
          include: {
            artista: { select: { id: true, nome: true, avatarUrl: true } },
          },
        },
      },
    });

    const tracks = reproducoes
      // Se a faixa foi apagada, o registro de reprodução pode ter ficado
      // órfão até o cascade rodar; ignora por segurança.
      .filter((r) => r.faixa)
      .map((r) => ({
        id: r.faixa.id,
        title: r.faixa.titulo,
        artist_id: r.faixa.artistaId,
        artist_name: r.faixa.artista.nome,
        cover_url: r.faixa.coverUrl || r.faixa.artista.avatarUrl || null,
        audio_url: r.faixa.audioUrl,
        duration: r.faixa.duracao,
        plays_count: r.faixa.playsCount,
        created_at: r.faixa.createdAt.toISOString(),
        listen_count: r.vezes,
      }));

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error('[PLAYS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar músicas mais ouvidas' }, { status: 500 });
  }
}
