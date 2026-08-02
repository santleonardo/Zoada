import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';

// GET /api/account/data-export — Exporta TODOS os dados pessoais do usuário
// logado num único JSON, cobrindo os direitos do art. 18 da LGPD:
//   I   - confirmação de que há tratamento
//   II  - acesso aos dados
//   V   - portabilidade a outro fornecedor
// Deliberadamente NÃO usa soft-delete filters (notDeleted) nas relações do
// próprio usuário: o titular tem direito de ver tudo que é dele, inclusive
// o que ele mesmo apagou e ainda está na janela de 30 dias da lixeira.
// Cobre cada relação do model Usuario em schema.prisma (ver ali a lista
// completa) — se um campo pessoal novo for adicionado a alguma dessas
// tabelas no futuro, adicione o `select` correspondente aqui também.
export async function GET(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const usuario = await db.usuario.findUnique({ where: { id: userId } });
    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const [
      artistas,
      faixas,
      curtidas,
      favoritos,
      reproducoes,
      seguindo,
      seguidores,
      seguidos,
      comentarios,
      postagens,
      curtidasPostagem,
      comentariosPostagem,
      curtidasComentarioPostagem,
      comentariosRadio,
      mensagensEnviadas,
      mensagensRecebidas,
      estacaoRadio,
    ] = await Promise.all([
      db.artista.findMany({ where: { usuarioId: userId } }),
      db.faixa.findMany({ where: { artista: { usuarioId: userId } }, include: { artista: { select: { nome: true } } } }),
      db.curtida.findMany({ where: { usuarioId: userId }, include: { faixa: { select: { titulo: true } } } }),
      db.favorito.findMany({ where: { usuarioId: userId }, include: { faixa: { select: { titulo: true } } } }),
      db.reproducao.findMany({ where: { usuarioId: userId }, include: { faixa: { select: { titulo: true } } } }),
      db.seguindo.findMany({ where: { usuarioId: userId }, include: { artista: { select: { nome: true } } } }),
      db.seguirUsuario.findMany({ where: { seguidoId: userId }, include: { seguidor: { select: { name: true } } } }),
      db.seguirUsuario.findMany({ where: { seguidorId: userId }, include: { seguido: { select: { name: true } } } }),
      db.comentario.findMany({ where: { usuarioId: userId }, include: { faixa: { select: { titulo: true } } } }),
      db.postagem.findMany({ where: { usuarioId: userId } }),
      db.curtidaPostagem.findMany({ where: { usuarioId: userId } }),
      db.comentarioPostagem.findMany({ where: { usuarioId: userId } }),
      db.curtidaComentarioPostagem.findMany({ where: { usuarioId: userId } }),
      db.comentarioRadio.findMany({ where: { usuarioId: userId } }),
      db.mensagem.findMany({ where: { remetenteId: userId }, include: { destinatario: { select: { name: true } } } }),
      db.mensagem.findMany({ where: { destinatarioId: userId }, include: { remetente: { select: { name: true } } } }),
      db.estacaoRadio.findUnique({ where: { usuarioId: userId }, include: { faixasEstacao: true } }),
    ]);

    const exportedAt = new Date();

    const data = {
      aviso:
        'Cópia dos seus dados pessoais no Zôada, conforme o art. 18 da LGPD (Lei nº 13.709/2018). ' +
        'Este arquivo contém todos os dados pessoais associados à sua conta no momento da exportação.',
      exportado_em: exportedAt.toISOString(),

      perfil: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.name,
        bio: usuario.bio,
        avatar_url: usuario.avatarUrl,
        criado_em: usuario.createdAt.toISOString(),
        atualizado_em: usuario.updatedAt.toISOString(),
        ultima_vez_online: usuario.lastSeenAt?.toISOString() ?? null,
        conta_apagada_em: usuario.deletedAt?.toISOString() ?? null,
      },

      artistas_criados: artistas.map((a) => ({
        id: a.id,
        nome: a.nome,
        bio: a.bio,
        genero: a.genero,
        avatar_url: a.avatarUrl,
        cover_url: a.coverUrl,
        criado_em: a.createdAt.toISOString(),
        apagado_em: a.deletedAt?.toISOString() ?? null,
      })),

      faixas_enviadas: faixas.map((f) => ({
        id: f.id,
        titulo: f.titulo,
        artista: f.artista.nome,
        duracao_segundos: f.duracao,
        reproducoes_totais: f.playsCount,
        criado_em: f.createdAt.toISOString(),
        apagado_em: f.deletedAt?.toISOString() ?? null,
      })),

      curtidas: curtidas.map((c) => ({
        faixa: c.faixa.titulo,
        curtido_em: c.createdAt.toISOString(),
      })),

      favoritos: favoritos.map((f) => ({
        faixa: f.faixa.titulo,
        favoritado_em: f.createdAt.toISOString(),
      })),

      // Contador pessoal de reproduções por faixa — base do "Mais Ouvidas".
      historico_de_escuta: reproducoes.map((r) => ({
        faixa: r.faixa.titulo,
        vezes_ouvida: r.vezes,
        ultima_atualizacao: r.updatedAt.toISOString(),
      })),

      artistas_seguidos: seguindo.map((s) => ({
        artista: s.artista.nome,
        seguindo_desde: s.createdAt.toISOString(),
      })),

      seguidores: seguidores.map((s) => ({
        usuario: s.seguidor.name,
        seguindo_desde: s.createdAt.toISOString(),
      })),

      seguindo_usuarios: seguidos.map((s) => ({
        usuario: s.seguido.name,
        seguindo_desde: s.createdAt.toISOString(),
      })),

      comentarios_em_faixas: comentarios.map((c) => ({
        faixa: c.faixa.titulo,
        conteudo: c.conteudo,
        comentado_em: c.createdAt.toISOString(),
      })),

      postagens: postagens.map((p) => ({
        id: p.id,
        legenda: p.legenda,
        criado_em: p.createdAt.toISOString(),
        apagado_em: p.deletedAt?.toISOString() ?? null,
      })),

      reacoes_em_postagens: curtidasPostagem.map((c) => ({
        postagem_id: c.postagemId,
        reagido_em: c.createdAt.toISOString(),
      })),

      comentarios_em_postagens: comentariosPostagem.map((c) => ({
        postagem_id: c.postagemId,
        conteudo: c.conteudo,
        comentado_em: c.createdAt.toISOString(),
        apagado_em: c.deletedAt?.toISOString() ?? null,
      })),

      reacoes_em_comentarios: curtidasComentarioPostagem.map((c) => ({
        comentario_id: c.comentarioId,
        reagido_em: c.createdAt.toISOString(),
      })),

      comentarios_na_radio: comentariosRadio.map((c) => ({
        conteudo: c.conteudo,
        comentado_em: c.createdAt.toISOString(),
      })),

      // Chat privado — incluído porque é dado pessoal do titular (tanto o
      // que ele enviou quanto o que recebeu). O nome do outro participante
      // é incluído só como referência de contexto da conversa.
      mensagens_enviadas: mensagensEnviadas.map((m) => ({
        para: m.destinatario.name,
        conteudo: m.conteudo,
        enviada_em: m.createdAt.toISOString(),
        lida: m.lida,
      })),
      mensagens_recebidas: mensagensRecebidas.map((m) => ({
        de: m.remetente.name,
        conteudo: m.conteudo,
        recebida_em: m.createdAt.toISOString(),
        lida: m.lida,
      })),

      estacao_de_radio: estacaoRadio
        ? {
            id: estacaoRadio.id,
            nome: estacaoRadio.nome,
            bio: estacaoRadio.bio,
            publicada: estacaoRadio.publicada,
            numero_de_faixas: estacaoRadio.faixasEstacao.length,
            criada_em: estacaoRadio.createdAt.toISOString(),
            apagada_em: estacaoRadio.deletedAt?.toISOString() ?? null,
          }
        : null,
    };

    // Content-Disposition faz o navegador baixar como arquivo em vez de
    // só exibir o JSON na aba — reforça a ideia de "cópia portátil dos
    // seus dados" exigida pelo inciso V do art. 18.
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="zoada-meus-dados-${exportedAt.toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error('[ACCOUNT DATA EXPORT]', error);
    return NextResponse.json({ error: 'Erro ao exportar dados' }, { status: 500 });
  }
}
