import { parseCsv, parseDate } from "@/lib/integrations/parse";
import { guestSchema, type GuestInput } from "@/lib/reservations/rules";

// ================================================================
// IMPORTAR CADASTRO DE HÓSPEDES (sistema antigo → este) — sem banco
// ================================================================

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ALIASES: Record<string, string[]> = {
  fullName: ["nome", "nome completo", "hospede", "cliente", "name", "full name", "guest"],
  docType: ["tipo documento", "tipo de documento", "tipo doc", "document type"],
  docNumber: ["documento", "cpf", "rg", "passaporte", "doc", "document", "numero documento"],
  birthDate: ["nascimento", "data de nascimento", "data nascimento", "birth date", "birthday", "dt nascimento"],
  email: ["email", "e mail"],
  phone: ["telefone", "celular", "fone", "phone", "whatsapp"],
  nationality: ["nacionalidade", "nationality"],
  gender: ["sexo", "genero", "gender"],
  city: ["cidade", "city", "municipio"],
  state: ["estado", "uf", "state"],
  country: ["pais", "country"],
  zipCode: ["cep", "zip", "codigo postal"],
  address: ["endereco", "logradouro", "address"],
  profession: ["profissao", "ocupacao", "profession"],
  notes: ["observacoes", "observacao", "obs", "notes"],
};

const GENDER: Record<string, string> = { m: "M", masculino: "M", male: "M", f: "F", feminino: "F", female: "F", outro: "OUTRO", other: "OUTRO" };

export type GuestRow = { line: number; data?: GuestInput; error?: string };

export function parseGuestsFile(text: string): { rows: GuestRow[]; missing: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], missing: ["arquivo vazio"] };
  const header = table[0].map(norm);
  const col: Record<string, number> = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    const i = names.map((n) => header.indexOf(n)).find((x) => x >= 0);
    if (i !== undefined && !Object.values(col).includes(i)) col[key] = i;
  }
  if (col.fullName === undefined) return { rows: [], missing: ["nome do hóspede"] };

  const rows = table.slice(1).map((cells, i): GuestRow => {
    const line = i + 2;
    const get = (k: string) => (col[k] === undefined ? "" : (cells[col[k]] ?? "").trim());
    const doc = get("docNumber");
    const digits = doc.replace(/\D/g, "");
    // Sem tipo informado: 11 números = CPF; com letras = passaporte; senão RG.
    const typeRaw = norm(get("docType"));
    const docType = typeRaw.includes("cpf") ? "CPF" : typeRaw.includes("pass") ? "PASSAPORTE" : typeRaw.includes("rg") ? "RG" : !doc ? "" : digits.length === 11 && /^[\d.\-\s]+$/.test(doc) ? "CPF" : /[a-z]/i.test(doc) ? "PASSAPORTE" : "RG";
    const birth = get("birthDate");
    const parsed = guestSchema.safeParse({
      fullName: get("fullName").replace(/\s+/g, " "),
      docType,
      docNumber: doc,
      birthDate: birth ? (parseDate(birth) ?? "invalida") : "",
      email: get("email"),
      phone: get("phone"),
      nationality: get("nationality") || undefined,
      gender: GENDER[norm(get("gender"))] ?? "",
      city: get("city"),
      state: get("state"),
      country: get("country") || (get("city") ? "Brasil" : ""),
      zipCode: get("zipCode"),
      address: get("address"),
      profession: get("profession"),
      notes: get("notes"),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { line, error: `${String(first.path.at(-1) ?? "")}: ${first.message}`.replace(/^: /, "") };
    }
    return { line, data: parsed.data };
  });
  return { rows, missing: [] };
}
