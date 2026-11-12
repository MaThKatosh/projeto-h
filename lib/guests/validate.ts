// ================================================================
// VALIDAÇÕES DA FICHA DO HÓSPEDE (sem dependências do servidor)
// ================================================================

// CPF: 11 dígitos, não pode ser tudo igual, e os 2 dígitos verificadores batem.
export function isValidCpf(input: string): boolean {
  const d = input.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

export function formatCpf(input: string): string {
  const d = input.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : input;
}

// Nascimento: data real, não no futuro e no máximo 120 anos atrás.
export function birthDateProblem(value: string, today = new Date()): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "Data inválida.";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return "Data inválida.";
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (date.getTime() > todayUtc) return "A data de nascimento não pode ser no futuro.";
  if (y < today.getFullYear() - 120) return "Confira o ano de nascimento (mais de 120 anos).";
  return null;
}

// CEP brasileiro: 8 dígitos → "00000-000".
export function normalizeCep(input: string): string | null {
  const d = input.replace(/\D/g, "");
  if (d.length !== 8 || /^0{8}$/.test(d)) return null;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export const isBrazil = (country: string | null | undefined) => !country || /^(brasil|brazil|br)$/i.test(country.trim());
