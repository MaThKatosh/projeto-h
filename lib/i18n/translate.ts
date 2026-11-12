// ================================================================
// TRADUÇÃO (sem dependências: servidor e tela)
// ================================================================
//
// O texto em português é a própria "chave": t("Mapa de quartos").
// Em inglês/espanhol, procuramos no dicionário; se não houver tradução,
// mostramos o português (nunca uma tela vazia).
//
// Partes variáveis usam {0}, {1}...: t("Quarto {0}", [numero]).

export type Dict = Record<string, string>;
export type TFunction = (text: unknown, params?: unknown[]) => string;

export function translate(dict: Dict | null, text: unknown, params?: unknown[]): string {
  if (text === null || text === undefined) return "";
  const s = String(text);
  let out = s;
  if (dict) out = dict[s] ?? dict[s.trim()] ?? s;
  if (params && params.length) out = out.replace(/\{(\d+)\}/g, (_, i) => String(params[Number(i)] ?? ""));
  return out;
}

export function makeT(dict: Dict | null): TFunction {
  return (text, params) => translate(dict, text, params);
}
