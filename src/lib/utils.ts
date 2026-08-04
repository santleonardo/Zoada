import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formata contagens grandes de forma compacta (ex: 1500 -> "1.5k"), usado
 * para número de reproduções, seguidores, etc. */
export function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

/** Formata uma data como tempo relativo curto (ex: "agora", "5min",
 * "3h", "2d", "3sem"), usado nas notificações. Cai pra data curta
 * (dd/mm) depois de ~4 semanas, pra não ficar um número gigante. */
export function formatRelativeTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'agora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek}sem`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
