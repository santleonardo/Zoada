import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// GET /api/plays?limit=10            — Top faixas mais ouvidas PELO USUÁRIO
//                                       LOGADO, ordenadas da mais pra menos
//                                       ouvida (ex: 15x aparece antes de 10x).
// GET /api/plays?user_id=xxx&limit=10 — Mesma coisa, mas pro perfil PÚBLICO
//                                       de outro usuário (não exige login,
//                                       igual à vitrine de /api/users?id=).
// Isso é diferente de faixas.plays_count (que é a contagem global, de
// todo mundo) — aqui é só o hábito de escuta de um usuário específico,
// usado na seção "Mais ouvidas" do perfil (próprio ou de terceiros).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('user_id');

    let userId: string;
    if (targetUserId) {
      // Perfil público de outro usuário: não exige autenticação.
      userId = targetUserId;
    } else {
      const authedUserId = await authenticateRequest(request);
      if (!authedUserId) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }
      userId = authedUserId;
    }

    if (!isNeonConfigured) {
      return NextResponse.json({ tracks: [] });
    }

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
