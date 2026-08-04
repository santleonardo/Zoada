import { db } from '@/lib/db';
import { isNeonConfigured } from '@/lib/config';

// Tipos espelham o enum TipoNotificacao do prisma/schema.prisma.
export type TipoNotificacao =
  | 'SEGUIDOR'
  | 'SEGUIDOR_ARTISTA'
  | 'CURTIDA_POSTAGEM'
  | 'COMENTARIO_POSTAGEM'
  | 'CURTIDA_COMENTARIO';

interface CriarNotificacaoInput {
  /** Quem recebe/vê a notificação. */
  usuarioId: string;
  /** Quem fez a ação que gerou a notificação. */
  atorId: string;
  tipo: TipoNotificacao;
  postagemId?: string | null;
  comentarioId?: string | null;
  artistaId?: string | null;
}

// Cria uma notificação para `usuarioId` avisando sobre uma ação de
// `atorId`. Usada pelas rotas de seguir, curtir e comentar — sempre
// DEPOIS de a ação principal já ter sido salva com sucesso.
//
// Duas garantias importantes:
// - Nunca notifica alguém sobre a própria ação (ex: curtir a própria
//   postagem, ou o dono de um artista seguindo o próprio artista).
// - Uma falha aqui nunca derruba a rota que chamou: notificação é um
//   "extra" — se a criação falhar, só logamos e seguimos em frente, pra
//   não fazer um curtir/seguir/comentar válido retornar erro por causa
//   disso.
export async function criarNotificacao(input: CriarNotificacaoInput): Promise<void> {
  if (!isNeonConfigured) return;
  if (input.usuarioId === input.atorId) return;

  try {
    await db.notificacao.create({
      data: {
        usuarioId: input.usuarioId,
        atorId: input.atorId,
        tipo: input.tipo,
        postagemId: input.postagemId ?? null,
        comentarioId: input.comentarioId ?? null,
        artistaId: input.artistaId ?? null,
      },
    });
  } catch (err) {
    console.error('[criarNotificacao]', err);
  }
}
