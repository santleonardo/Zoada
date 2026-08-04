import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { isNeonConfigured } from '@/lib/config';
import { notDeleted } from '@/lib/soft-delete';

// GET /api/users?id=xxx       -> perfil público de UM usuário (nome, foto,
//                                 artistas que ele criou, seguidores/seguindo).
//                                 Não exige login: é uma vitrine pública.
//                                 Se houver token de autenticação, retorna
//                                 também `is_following` (se o viewer segue
//                                 esse usuário).
// GET /api/users?search=xxx   -> Busca usuários por nome/email (autenticado).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      if (!isNeonConfigured) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      const usuario = await db.usuario.findFirst({
        where: { id, ...notDeleted },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          lastSeenAt: true,
          createdAt: true,
          seguidoresCount: true,
          seguindoCount: true,
          artistas: {
            where: { ...notDeleted },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              nome: true,
              avatarUrl: true,
              coverUrl: true,
              bio: true,
              genero: true,
              seguidoresCount: true,
            },
          },
        },
      });

      if (!usuario) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      // Verifica se quem está vendo o perfil segue esse usuário
      // (tenta pegar o token sem obrigar autenticação — se não tiver,
      // is_following será null, indicando "não verificado / não logado").
      let isFollowing: boolean | null = null;
      const viewerId = await authenticateRequest(request);
      if (viewerId && viewerId !== id) {
        const relation = await db.seguirUsuario.findUnique({
          where: {
            seguidorId_seguidoId: {
              seguidorId: viewerId,
              seguidoId: id,
            },
          },
        });
        isFollowing = !!relation;
      }

      return NextResponse.json({
        user: {
          id: usuario.id,
          name: usuario.name,
          avatar_url: usuario.avatarUrl,
          last_seen_at: usuario.lastSeenAt?.toISOString() ?? null,
          created_at: usuario.createdAt.toISOString(),
          followers_count: usuario.seguidoresCount,
          following_count: usuario.seguindoCount,
          is_following: isFollowing,
          artists: usuario.artistas.map((a) => ({
            id: a.id,
            user_id: id,
            name: a.nome,
            avatar_url: a.avatarUrl,
            cover_url: a.coverUrl,
            bio: a.bio,
            genre: a.genero,
            followers_count: a.seguidoresCount,
          })),
        },
      });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const search = (searchParams.get('search') || '').trim();

    if (!search) {
      return NextResponse.json({ users: [] });
    }

    if (!isNeonConfigured) {
      // Sem banco configurado não há usuários reais pra buscar.
      return NextResponse.json({ users: [] });
    }

    // Busca só por nome (não por email): permitir buscar por email deixava
    // qualquer usuário logado descobrir o endereço completo de outra
    // pessoa, e ainda testar em massa se um email específico está
    // cadastrado no app. O email de outros usuários nunca é devolvido
    // aqui — só o do próprio dono é exposto (ex: tela de conta).
    const usuarios = await db.usuario.findMany({
      where: {
        id: { not: userId }, // não retorna o próprio usuário logado
        ...notDeleted,
        name: { contains: search, mode: 'insensitive' },
      },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: 'asc' },
      take: 20,
    });

    const users = usuarios.map((u) => ({
      id: u.id,
      email: '',
      name: u.name,
      avatar_url: u.avatarUrl,
      created_at: '',
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('[USERS GET]', error);
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
  }
}

// PATCH /api/users — Atualiza o PRÓPRIO perfil do usuário logado (nome
// e/ou foto de perfil). Não recebe id no corpo: sempre edita quem está
// autenticado, então não há como um usuário editar o perfil de outro.
export async function PATCH(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { name, avatarUrl } = await request.json();

    if (name !== undefined && !String(name).trim()) {
      return NextResponse.json({ error: 'Nome não pode ficar vazio' }, { status: 400 });
    }

    const usuario = await db.usuario.update({
      where: { id: userId },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
    });

    return NextResponse.json({
      user: {
        id: usuario.id,
        email: usuario.email,
        name: usuario.name,
        avatar_url: usuario.avatarUrl,
        created_at: usuario.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[USERS PATCH]', error);
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}

// DELETE /api/users — Apaga a PRÓPRIA conta do usuário logado (LGPD art.
// 18, VI — eliminação — e o direito de cancelamento fácil que a Política
// de Privacidade promete no item 8). Sempre age sobre quem está
// autenticado: não recebe id no corpo, então não há como um usuário apagar
// a conta de outro. Exige a senha atual como confirmação, já que é uma
// ação irreversível.
//
// Ordem da exclusão:
//  1) Apaga os Artistas do usuário — a relação Faixa->Artista tem onDelete
//     Cascade no schema, então isso já leva junto todas as faixas
//     enviadas por ele (e o que cascateia a partir delas: curtidas,
//     favoritos, comentários, faixas de estação). É a mesma lógica do
//     DELETE /api/artists, só que para todos os artistas do usuário de
//     uma vez.
//  2) Apaga a linha do Usuario — todas as demais relações dele (mensagens,
//     posts, comentários, seguidores, estação de rádio, etc.) têm
//     onDelete Cascade explícito no schema, então somem automaticamente.
//  3) Limpa os arquivos no R2 (avatar do usuário + avatar/capa de cada
//     artista + áudio/capa de cada faixa) — best-effort, igual ao padrão
//     já usado em /api/tracks e /api/artists: se falhar, não desfazemos a
//     exclusão, só avisamos no log.
export async function DELETE(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { password } = await request.json().catch(() => ({ password: undefined }));
    if (!password) {
      return NextResponse.json({ error: 'Confirme sua senha para excluir a conta' }, { status: 400 });
    }

    const usuario = await db.usuario.findUnique({
      where: { id: userId },
    });
    if (!usuario || usuario.deletedAt) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    if (!usuario.passwordHash) {
      return NextResponse.json({ error: 'Não foi possível confirmar sua senha' }, { status: 400 });
    }

    const isValid = await bcrypt.compare(password, usuario.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }

    // Soft-delete: marca `deletedAt` na conta e cascateia pra tudo que é
    // "dela" e apareceria em listagens públicas — artistas, faixas,
    // estação de rádio e postagens no feed. Nada é apagado do banco nem
    // do R2 agora; isso só acontece 30 dias depois, no job de limpeza
    // (/api/cron/purge-deleted). Fazendo login de novo com a senha certa
    // dentro do prazo restaura tudo (ver POST /api/auth/login).
    const now = new Date();
    await db.$transaction([
      db.usuario.update({ where: { id: userId }, data: { deletedAt: now } }),
      db.artista.updateMany({ where: { usuarioId: userId, deletedAt: null }, data: { deletedAt: now } }),
      db.faixa.updateMany({ where: { artista: { usuarioId: userId }, deletedAt: null }, data: { deletedAt: now } }),
      db.estacaoRadio.updateMany({ where: { usuarioId: userId, deletedAt: null }, data: { deletedAt: now } }),
      db.postagem.updateMany({ where: { usuarioId: userId, deletedAt: null }, data: { deletedAt: now } }),
    ]);

    return NextResponse.json({ deleted: true, retention_days: 30 });
  } catch (error) {
    console.error('[USERS DELETE]', error);
    return NextResponse.json({ error: 'Erro ao excluir conta' }, { status: 500 });
  }
}
