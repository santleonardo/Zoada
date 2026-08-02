// Constantes e helpers compartilhados por todas as rotas que fazem
// soft-delete (conta, artistas, faixas, postagens, comentários de postagem
// e estação de rádio). A regra é sempre a mesma: marcar `deletedAt` em vez
// de apagar a linha, deixar 30 dias pra desfazer, e um job (ver
// /api/cron/purge-deleted) apaga de vez o que passou do prazo.

export const SOFT_DELETE_RETENTION_DAYS = 30;

// Filtro pronto pra usar em qualquer `where` de listagem/leitura pública:
// `{ ...notDeleted }` garante que itens soft-deletados não aparecem.
export const notDeleted = { deletedAt: null } as const;

// Data limite: tudo com deletedAt ANTERIOR a isso já passou dos 30 dias
// e pode ser apagado de vez pelo job de limpeza.
export function purgeCutoff(): Date {
  return new Date(Date.now() - SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

// Quantos dias ainda restam pra restaurar algo apagado em `deletedAt`
// (0 se já venceu — nesse caso o item só ainda não foi varrido pelo job).
export function daysLeftToRestore(deletedAt: Date): number {
  const elapsedMs = Date.now() - deletedAt.getTime();
  const remainingMs = SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000 - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

export function isExpired(deletedAt: Date): boolean {
  return deletedAt.getTime() < purgeCutoff().getTime();
}
