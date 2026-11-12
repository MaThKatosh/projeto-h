import table from "./countries.json";

// Países: [código ISO, português, inglês, espanhol]. O nome em português é o
// que fica gravado; na tela aparece no idioma do funcionário. A lista é fixa
// (gerada uma vez) para servidor e navegador mostrarem exatamente o mesmo.
const ROWS = table as [string, string, string, string][];

export const COUNTRIES = ROWS.map(([code, name]) => ({ code, name }));

const column = (locale: string) => (locale.startsWith("en") ? 2 : locale.startsWith("es") ? 3 : 1);

// Opções para o <select>: Brasil primeiro; valor antigo fora da lista continua aparecendo.
export function countryOptions(locale: string, current?: string | null): { value: string; label: string }[] {
  const col = column(locale);
  const opts = ROWS.map((r) => ({ value: r[1], label: r[col] }));
  const br = opts.find((o) => o.value === "Brasil")!;
  // Ordem sem acentos, igual em qualquer navegador.
  const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const rest = opts.filter((o) => o !== br).sort((a, b) => (key(a.label) < key(b.label) ? -1 : key(a.label) > key(b.label) ? 1 : 0));
  const list = [br, ...rest];
  if (current && !list.some((o) => o.value === current)) list.unshift({ value: current, label: current });
  return list;
}

// Valor antigo "Brasileira" (texto livre) → país.
export function normalizeCountry(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^brasileir[oa]$/i.test(v)) return "Brasil";
  return v;
}
