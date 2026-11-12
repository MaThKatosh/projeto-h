// Dinheiro em CENTAVOS (inteiro) — nunca em número quebrado.

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}

// "1.234,56" | "1234,5" | "1234.56" | "R$ 250" → centavos. null se inválido.
export function parseBRL(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  if (typeof input !== "string") return null;
  let s = input.replace(/R\$|\s/g, "").trim();
  if (!s) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

// Para preencher campos de formulário: 15000 → "150,00"
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

// Porcentagem guardada em centésimos: 500 → "5%", 250 → "2,5%"
export function formatPercent(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
