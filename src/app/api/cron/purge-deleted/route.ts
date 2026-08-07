import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isNeonConfigured, isR2Configured, CRON_SECRET } from '@/lib/config';
import { deleteFromR2, keyFromPublicUrl } from '@/lib/r2';
import { purgeCutoff } from '@/lib/soft-delete';
import { isValidBearerSecret } from '@/lib/rateLimit';

// GET /api/cron/purge-deleted
// Varre tudo que foi soft-deletado (conta, artista, faixa, postagem,
// comentário de postagem, estação de rádio) há mais de 30 dias e apaga de
// vez — linha do banco + arquivos no R2. Feito pra ser chamado uma vez por
// dia pelo Vercel Cron (ver vercel.json). Protegido por CRON_SECRET: sem
// o header certo, recusa a chamada (evita qualquer um disparar a limpeza
// batendo na URL).
//
// Ordem importa: primeiro conta (cascata cuida de artista/faixa/estação/
// postagem/comentários dela via onDelete Cascade do schema), depois o que
// sobrar de cada tipo apagado avulso (ex: só uma faixa, sem a conta
// inteira ter sido apagada).
export async function GET(request: Request) {
  try {
    if (!isNeonConfigured) {
      return NextResponse.json({ error: 'Neon não configurado' }, { status: 503 });
    }

    if (CRON_SECRET) {
      if (!isValidBearerSecret(request, CRON_SECRET)) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }
    }

    const cutoff = purgeCutoff();
    const r2Keys: string[] = [];
    const summary = { usuarios: 0, artistas: 0, faixas: 0, postagens: 0, comentarios: 0, estacoes: 0, clubes: 0 };

    // ---------- 1) Contas apagadas há mais de 30 dias ----------
    const usuariosExpirados = await db.usuario.findMany({
      where: { deletedAt: { lt: cutoff } },
      include: {
        estacoesRadio: true,
        artistas: { include: { faixas: true } },
        fotosAlbum: true,
      },
    });

    for (const usuario of usuariosExpirados) {
      if (isR2Configured) {
        if (usuario.avatarUrl) {
          const k = keyFromPublicUrl(usuario.avatarUrl);
          if (k) r2Keys.push(k);
        }
        for (const foto of usuario.fotosAlbum) {
          if (foto.key && !foto.key.startsWith('local:')) {
            r2Keys.push(foto.key);
          } else if (foto.url) {
            const k = keyFromPublicUrl(foto.url);
            if (k) r2Keys.push(k);
          }
        }
        for (const e of usuario.estacoesRadio) {
          if (e.capaUrl) {
            const k = keyFromPublicUrl(e.capaUrl);
            if (k) r2Keys.push(k);
          }
        }
        for (const a of usuario.artistas) {
          if (a.avatarUrl) {
            const k = keyFromPublicUrl(a.avatarUrl);
            if (k) r2Keys.push(k);
          }
          if (a.coverUrl) {
            const k = keyFromPublicUrl(a.coverUrl);
            if (k) r2Keys.push(k);
          }
          for (const f of a.faixas) {
            for (const url of [f.audioUrl, f.audioUrlLow, f.coverUrl]) {
              if (url) {
                const k = keyFromPublicUrl(url);
                if (k) r2Keys.push(k);
              }
            }
          }
        }
      }
      summary.faixas += usuario.artistas.reduce((n, a) => n + a.faixas.length, 0);
      summary.artistas += usuario.artistas.length;
      summary.estacoes += usuario.estacoesRadio.length;
    }

    if (usuariosExpirados.length > 0) {
      const ids = usuariosExpirados.map((u) => u.id);
      // Artista não tem onDelete Cascade a partir de Usuario no schema —
      // precisa apagar manualmente antes (isso leva as faixas dele junto,
      // essa relação SIM é Cascade). O resto (mensagens, posts,
      // comentários, estação, seguidores) cascateia ao apagar o Usuario.
      await db.artista.deleteMany({ where: { usuarioId: { in: ids } } });
      await db.usuario.deleteMany({ where: { id: { in: ids } } });
      summary.usuarios = usuariosExpirados.length;
    }

    // ---------- 2) Artistas apagados avulsos (conta continua ativa) ----------
    const artistasExpirados = await db.artista.findMany({
      where: { deletedAt: { lt: cutoff } },
      include: { faixas: true },
    });

    for (const a of artistasExpirados) {
      if (isR2Configured) {
        if (a.avatarUrl) {
          const k = keyFromPublicUrl(a.avatarUrl);
          if (k) r2Keys.push(k);
        }
        if (a.coverUrl) {
          const k = keyFromPublicUrl(a.coverUrl);
          if (k) r2Keys.push(k);
        }
        for (const f of a.faixas) {
          for (const url of [f.audioUrl, f.audioUrlLow, f.coverUrl]) {
            if (url) {
              const k = keyFromPublicUrl(url);
              if (k) r2Keys.push(k);
            }
          }
        }
      }
    }

    if (artistasExpirados.length > 0) {
      const ids = artistasExpirados.map((a) => a.id);
      await db.artista.deleteMany({ where: { id: { in: ids } } }); // cascata leva as faixas
      summary.artistas += artistasExpirados.length;
      summary.faixas += artistasExpirados.reduce((n, a) => n + a.faixas.length, 0);
    }

    // ---------- 3) Faixas apagadas avulsas (artista continua ativo) ----------
    const faixasExpiradas = await db.faixa.findMany({ where: { deletedAt: { lt: cutoff } } });

    if (isR2Configured) {
      for (const f of faixasExpiradas) {
        for (const url of [f.audioUrl, f.audioUrlLow, f.coverUrl]) {
          if (url) {
            const k = keyFromPublicUrl(url);
            if (k) r2Keys.push(k);
          }
        }
      }
    }

    if (faixasExpiradas.length > 0) {
      await db.faixa.deleteMany({ where: { id: { in: faixasExpiradas.map((f) => f.id) } } });
      summary.faixas += faixasExpiradas.length;
    }

    // ---------- 4) Postagens apagadas ----------
    const postagensExpiradas = await db.postagem.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    summary.postagens = postagensExpiradas.count;

    // ---------- 5) Comentários de postagem apagados ----------
    const comentariosExpirados = await db.comentarioPostagem.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    summary.comentarios = comentariosExpirados.count;

    // ---------- 5b) Comentários de postagem de clube apagados ----------
    const comentariosClubeExpirados = await db.comentarioPostagemClube.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    summary.comentarios += comentariosClubeExpirados.count;

    // ---------- 6) Estações de rádio apagadas avulsas ----------
    const estacoesExpiradas = await db.estacaoRadio.findMany({ where: { deletedAt: { lt: cutoff } } });
    if (isR2Configured) {
      for (const e of estacoesExpiradas) {
        if (e.capaUrl) {
          const k = keyFromPublicUrl(e.capaUrl);
          if (k) r2Keys.push(k);
        }
      }
    }
    if (estacoesExpiradas.length > 0) {
      await db.estacaoRadio.deleteMany({ where: { id: { in: estacoesExpiradas.map((e) => e.id) } } });
      summary.estacoes += estacoesExpiradas.length;
    }

    // ---------- 7) Clubes apagados (soft-delete há >30 dias) ----------
    // Cascade no schema leva membros e postagens do mural (e comentários
    // da thread via cascade da postagem).
    const clubesExpirados = await db.clube.findMany({ where: { deletedAt: { lt: cutoff } } });
    if (isR2Configured) {
      for (const c of clubesExpirados) {
        if (c.capaUrl) {
          const k = keyFromPublicUrl(c.capaUrl);
          if (k) r2Keys.push(k);
        }
      }
    }
    if (clubesExpirados.length > 0) {
      await db.clube.deleteMany({ where: { id: { in: clubesExpirados.map((c) => c.id) } } });
      summary.clubes += clubesExpirados.length;
    }

    // ---------- Limpeza dos arquivos no R2 (best-effort) ----------
    if (r2Keys.length > 0) {
      await Promise.all(
        r2Keys.map((key) =>
          deleteFromR2(key).catch((err) => console.warn('[PURGE DELETED] falha ao apagar arquivo no R2:', key, err))
        )
      );
    }

    return NextResponse.json({ purged: summary, r2_files_deleted: r2Keys.length, cutoff: cutoff.toISOString() });
  } catch (error) {
    console.error('[PURGE DELETED]', error);
    return NextResponse.json({ error: 'Erro ao limpar itens apagados' }, { status: 500 });
  }
}
