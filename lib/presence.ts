// ============================================================
// Regra de presença ("está online?")
// ============================================================
// Não temos WebSocket/long-polling no projeto, então "online" aqui
// significa "mandou um heartbeat pro servidor recentemente" — não é
// uma conexão em tempo real, é um sinal de vida com tolerância de
// alguns minutos. Client chama /api/presence periodicamente enquanto
// o app está aberto (ver sendHeartbeat em src/lib/api.ts).

// Janela de tolerância: se o último heartbeat foi há menos que isso,
// consideramos o usuário online.
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutos

// Intervalo entre heartbeats do client. Precisa ser bem menor que o
// threshold acima pra não "piscar" offline entre um heartbeat e outro.
export const HEARTBEAT_INTERVAL_MS = 45 * 1000; // 45 segundos

export function isOnline(lastSeenAt: string | Date | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const lastSeenMs = new Date(lastSeenAt).getTime();
  if (Number.isNaN(lastSeenMs)) return false;
  return Date.now() - lastSeenMs < ONLINE_THRESHOLD_MS;
}

// Texto tipo "visto há 5m" pra quando a pessoa não está mais online.
export function formatLastSeen(lastSeenAt: string | Date | null | undefined): string {
  if (!lastSeenAt) return 'Visto há um tempo';
  const date = new Date(lastSeenAt);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Visto agora';
  if (diffMins < 60) return `Visto há ${diffMins}m`;
  if (diffHours < 24) return `Visto há ${diffHours}h`;
  if (diffDays < 7) return `Visto há ${diffDays}d`;
  return `Visto em ${date.toLocaleDateString('pt-BR')}`;
}
