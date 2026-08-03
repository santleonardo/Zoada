import { db } from '@/lib/db';
import { MODERATION_ADMIN_EMAILS } from '@/lib/config';

// ============================================================
// Quem pode entrar no painel de moderação (/api/moderacao/login):
// 1) Emails fixos via env var MODERATION_ADMIN_EMAILS (sempre admin,
//    não aparecem como "convidados" e não dá pra remover pelo painel).
// 2) Emails convidados dinamicamente pelo próprio painel, guardados na
//    tabela AdminModeracao (ver /api/moderacao/admins).
// Em ambos os casos, o email também precisa bater com uma conta real e
// com senha na tabela Usuario — isso é checado em /api/moderacao/login
// e na hora de convidar, não aqui.
// ============================================================

export async function isModerationAdminEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (MODERATION_ADMIN_EMAILS.includes(normalized)) return true;

  const convidado = await db.adminModeracao.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { id: true },
  });
  return !!convidado;
}
