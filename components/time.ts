// "há 5 min", "há 2 h 10 min" — a partir de um "agora" passado de fora
// (evita diferença entre servidor e navegador na primeira renderização).
export function since(iso: string, now: number, tr: (s: string, p?: (string | number)[]) => string = (s, p) => s.replace(/\{(\d+)\}/g, (_, i) => String(p?.[Number(i)] ?? ""))): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (minutes < 1) return tr("agora");
  if (minutes < 60) return tr("há {0} min", [minutes]);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? tr("há {0} h {1} min", [hours, rest]) : tr("há {0} h", [hours]);
  const days = Math.floor(hours / 24);
  return days === 1 ? tr("há 1 dia") : tr("há {0} dias", [days]);
}

export function duration(fromIso: string, toIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
