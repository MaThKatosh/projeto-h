import { isDateStr, nightsBetween, type DateStr } from "@/lib/dates";

// ================================================================
// IMPORTAÇÃO DE RESERVAS DOS PORTAIS — leitura do arquivo (sem banco)
// Aceita a planilha exportada do extranet do Booking.com (português ou
// inglês), da Expedia / Hoteis.com e o modelo próprio do sistema.
// ================================================================

// Reserva vinda de fora, já no formato do sistema.
export type ExternalReservation = {
  externalCode: string;
  cancelled: boolean;
  guestName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  checkIn: DateStr;
  checkOut: DateStr;
  adults: number;
  children: number;
  roomTypeLabel: string;
  totalCents: number | null;
  rooms: number;
  notes: string | null;
};

export type ParsedRow = { line: number; data?: ExternalReservation; error?: string };

// ---------------------------------------------------------------- CSV

// Lê CSV com ";" ou "," (detecta pelo cabeçalho), aspas e BOM do Excel.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = count(firstLine, ";") > count(firstLine, ",") ? ";" : count(firstLine, "\t") > count(firstLine, ",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

function count(s: string, ch: string) {
  return s.split(ch).length - 1;
}

// ---------------------------------------------------------------- colunas

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Nomes de coluna conhecidos (já normalizados), em ordem de preferência.
const ALIASES: Record<string, string[]> = {
  code: ["codigo", "book number", "numero da reserva", "reservation id", "confirmation", "confirmation number", "itinerary", "reservation number", "booking id", "id da reserva", "localizador"],
  guest: ["hospede", "guest name s", "nome s do s hospede s", "guest name", "guest", "nome do hospede", "nome"],
  booker: ["booked by", "reservado por", "booker name"],
  email: ["email", "e mail", "guest email"],
  phone: ["telefone", "phone number", "phone", "numero de telefone"],
  country: ["pais", "booker country", "pais do cliente", "country"],
  checkIn: ["entrada", "check in", "arrival", "chegada", "check in date"],
  checkOut: ["saida", "check out", "departure", "partida", "check out date"],
  adults: ["adultos", "adults"],
  children: ["criancas", "children"],
  people: ["pessoas", "people", "persons", "guests", "hospedes"],
  roomType: ["tipo de quarto", "tipo quarto", "unit type", "tipo de unidade", "room type", "room", "quarto", "accommodation"],
  rooms: ["quartos", "rooms", "unidades"],
  total: ["valor total", "valor", "price", "preco", "total", "booking amount", "total amount", "amount", "total price"],
  status: ["status", "situacao", "reservation status"],
  notes: ["observacoes", "remarks", "observacao", "special requests", "pedidos especiais", "comentarios"],
};

export type ColumnMap = Partial<Record<keyof typeof ALIASES, number>>;

export function detectColumns(header: string[]): ColumnMap {
  const h = header.map(norm);
  const map: ColumnMap = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    for (const name of names) {
      const idx = h.indexOf(name);
      if (idx >= 0 && !Object.values(map).includes(idx)) {
        map[key as keyof typeof ALIASES] = idx;
        break;
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------- valores

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, abr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, ago: 8,
  sep: 9, set: 9, oct: 10, out: 10, nov: 11, dec: 12, dez: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
function ymd(y: number, m: number, d: number): DateStr | null {
  const s = `${y}-${pad(m)}-${pad(d)}`;
  return isDateStr(s) ? s : null;
}

// "2026-11-12", "12/11/2026" (dia primeiro), "12 Nov 2026", "Nov 12, 2026"; ignora horário.
export function parseDate(input: string): DateStr | null {
  const s = input.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    let d = +m[1];
    let mo = +m[2];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // só dá para ser mês/dia
    return ymd(y, mo, d);
  }
  m = norm(s).match(/^(\d{1,2}) (?:de )?([a-z]{3})[a-z]* (?:de )?(\d{4})/);
  if (m && MONTHS[m[2]]) return ymd(+m[3], MONTHS[m[2]], +m[1]);
  m = norm(s).match(/^([a-z]{3})[a-z]* (\d{1,2}) (\d{4})/);
  if (m && MONTHS[m[1]]) return ymd(+m[3], MONTHS[m[1]], +m[2]);
  return null;
}

// "450 BRL", "BRL 1,234.50", "R$ 1.234,50", "1234.5" → centavos.
export function parseMoney(input: string): number | null {
  let s = input.replace(/[^\d.,-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const decimalSep = lastComma > lastDot ? "," : ".";
  const decimals = s.length - 1 - Math.max(lastComma, lastDot);
  if (Math.max(lastComma, lastDot) >= 0 && decimals === 3 && s.split(decimalSep).length === 2 && !s.includes(decimalSep === "," ? "." : ",")) {
    // "1.234" ou "1,234": separador de milhar, não decimal
    s = s.replace(/[.,]/g, "");
  } else {
    s = s.replace(decimalSep === "," ? /\./g : /,/g, "").replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

function isCancelled(status: string): boolean {
  const s = norm(status);
  return /cancel|no show|nao compareceu|declined|recusad/.test(s);
}

function int(s: string | undefined, fallback: number): number {
  const n = parseInt(String(s ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------- arquivo

export type ParseResult = { rows: ParsedRow[]; missingColumns: string[] };

const REQUIRED: { key: keyof typeof ALIASES; label: string }[] = [
  { key: "code", label: "número da reserva" },
  { key: "checkIn", label: "entrada" },
  { key: "checkOut", label: "saída" },
];

export function parseReservationsFile(text: string): ParseResult {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], missingColumns: ["arquivo vazio"] };
  const cols = detectColumns(table[0]);
  const missingColumns = REQUIRED.filter((r) => cols[r.key] === undefined).map((r) => r.label);
  if (cols.guest === undefined && cols.booker === undefined) missingColumns.push("nome do hóspede");
  if (missingColumns.length) return { rows: [], missingColumns };

  const rows: ParsedRow[] = table.slice(1).map((cells, i) => {
    const line = i + 2;
    const get = (k: keyof typeof ALIASES) => (cols[k] === undefined ? "" : (cells[cols[k]!] ?? "").trim());
    const code = get("code");
    const guestName = (get("guest") || get("booker")).replace(/\s+/g, " ");
    const checkIn = parseDate(get("checkIn"));
    const checkOut = parseDate(get("checkOut"));
    if (!code) return { line, error: "sem número da reserva" };
    if (!guestName) return { line, error: "sem nome do hóspede" };
    if (!checkIn || !checkOut) return { line, error: "data de entrada ou saída ilegível" };
    if (nightsBetween(checkIn, checkOut) < 1) return { line, error: "saída não é depois da entrada" };
    const people = int(get("people"), 1);
    const adults = cols.adults !== undefined ? Math.max(1, int(get("adults"), 1)) : Math.max(1, people);
    const total = get("total");
    return {
      line,
      data: {
        externalCode: code.slice(0, 40),
        cancelled: isCancelled(get("status")),
        guestName: guestName.slice(0, 120),
        email: get("email") || null,
        phone: get("phone") || null,
        country: get("country") || null,
        checkIn,
        checkOut,
        adults: Math.min(adults, 20),
        children: Math.min(int(get("children"), 0), 20),
        roomTypeLabel: get("roomType"),
        totalCents: total ? parseMoney(total) : null,
        rooms: Math.max(1, int(get("rooms"), 1)),
        notes: get("notes") || null,
      },
    };
  });
  return { rows, missingColumns: [] };
}

// Escolhe o tipo de quarto do hotel com nome parecido com o do portal.
export function guessRoomType(label: string, types: { id: string; name: string }[]): string | null {
  const l = norm(label);
  if (!l) return types.length === 1 ? types[0].id : null;
  const exact = types.find((t) => norm(t.name) === l);
  if (exact) return exact.id;
  const contained = types.filter((t) => l.includes(norm(t.name)) || norm(t.name).includes(l));
  if (contained.length === 1) return contained[0].id;
  // mais palavras em comum
  const words = new Set(l.split(" ").filter((w) => w.length > 2));
  const scored = types
    .map((t) => ({ id: t.id, score: norm(t.name).split(" ").filter((w) => words.has(w)).length }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score);
  // empate: melhor a pessoa escolher
  if (!scored.length || (scored[1] && scored[1].score === scored[0].score)) return null;
  return scored[0].id;
}

// Modelo para quem não usa o arquivo do portal.
export const TEMPLATE_CSV =
  "codigo;hospede;email;telefone;entrada;saida;tipo de quarto;adultos;criancas;valor total;status;observacoes\r\n" +
  "ABC123;Maria Silva;maria@exemplo.com;11 99999-0000;20/12/2026;23/12/2026;Standard Casal;2;0;900,00;confirmada;Chega tarde\r\n";
