import { z } from "zod";
import { isDateStr, type DateStr } from "@/lib/dates";

// ================================================================
// REVENUE MANAGEMENT — cálculo do preço sugerido (sem servidor)
// Preço sugerido = preço base × (1 + soma dos ajustes das regras que valem
// para a noite). A soma fica entre -50% e +200% (trava de segurança).
// ================================================================

export const RULE_KINDS = ["OCUPACAO", "DIA_SEMANA", "PERIODO", "ANTECEDENCIA"] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export const KIND_LABEL: Record<RuleKind, { icon: string; label: string; hint: string }> = {
  OCUPACAO: { icon: "📈", label: "Ocupação alta", hint: "Quando a ocupação prevista da noite chega a X%" },
  DIA_SEMANA: { icon: "📅", label: "Dias da semana", hint: "Ex.: sexta e sábado" },
  PERIODO: { icon: "🎉", label: "Período / evento", hint: "Temporada, feriado, evento na cidade" },
  ANTECEDENCIA: { icon: "⏱", label: "Última hora", hint: "Faltando até X dias para a noite" },
};

export const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

export const MIN_ADJUST_BP = -5000;
export const MAX_ADJUST_BP = 20000;

export type Rule = {
  id: string;
  name: string;
  kind: RuleKind;
  params: { minOccupancy?: number; days?: number[]; from?: DateStr; to?: DateStr; maxDaysAhead?: number };
  adjustBp: number;
  roomTypeId: string | null;
  active: boolean;
};

export type NightContext = {
  date: DateStr;
  today: DateStr;
  occupancyPct: number; // ocupação prevista do hotel nessa noite (0–100)
  roomTypeId: string;
};

const dayIndex = (d: DateStr) => new Date(`${d}T12:00:00Z`).getUTCDay();
const daysBetween = (a: DateStr, b: DateStr) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function ruleApplies(rule: Rule, ctx: NightContext): boolean {
  if (!rule.active) return false;
  if (rule.roomTypeId && rule.roomTypeId !== ctx.roomTypeId) return false;
  const p = rule.params;
  switch (rule.kind) {
    case "OCUPACAO":
      return p.minOccupancy !== undefined && ctx.occupancyPct >= p.minOccupancy;
    case "DIA_SEMANA":
      return Boolean(p.days?.includes(dayIndex(ctx.date)));
    case "PERIODO":
      return Boolean(p.from && p.to && ctx.date >= p.from && ctx.date <= p.to);
    case "ANTECEDENCIA": {
      const ahead = daysBetween(ctx.today, ctx.date);
      return p.maxDaysAhead !== undefined && ahead >= 0 && ahead <= p.maxDaysAhead;
    }
  }
}

export type Suggestion = { price: number; adjustBp: number; applied: { name: string; adjustBp: number }[] };

export function suggestPrice(baseCents: number, rules: Rule[], ctx: NightContext): Suggestion {
  const applied = rules.filter((r) => ruleApplies(r, ctx)).map((r) => ({ name: r.name, adjustBp: r.adjustBp }));
  const total = Math.min(MAX_ADJUST_BP, Math.max(MIN_ADJUST_BP, applied.reduce((s, r) => s + r.adjustBp, 0)));
  // arredonda para R$ 1,00 (preço "de vitrine")
  const price = Math.round((baseCents * (10_000 + total)) / 10_000 / 100) * 100;
  return { price, adjustBp: total, applied };
}

// ---------------------------------------------------------------- formulário

export const ruleSchema = z
  .object({
    name: z.string().trim().min(3, "Dê um nome curto à regra (ex.: Fim de semana).").max(60),
    kind: z.enum(RULE_KINDS),
    adjustPercent: z.coerce.number().min(-50, "No máximo -50%.").max(200, "No máximo +200%.").refine((v) => v !== 0, "Use um ajuste diferente de 0%."),
    roomTypeId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    active: z.boolean().default(true),
    minOccupancy: z.coerce.number().int().min(1).max(100).optional(),
    days: z.array(z.coerce.number().int().min(0).max(6)).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    maxDaysAhead: z.coerce.number().int().min(0).max(60).optional(),
  })
  .superRefine((r, ctx) => {
    if (r.kind === "OCUPACAO" && r.minOccupancy === undefined) ctx.addIssue({ code: "custom", path: ["minOccupancy"], message: "Informe a ocupação (%)." });
    if (r.kind === "DIA_SEMANA" && !r.days?.length) ctx.addIssue({ code: "custom", path: ["days"], message: "Escolha pelo menos um dia." });
    if (r.kind === "PERIODO") {
      if (!isDateStr(r.from) || !isDateStr(r.to)) ctx.addIssue({ code: "custom", path: ["from"], message: "Informe o início e o fim." });
      else if (r.to < r.from) ctx.addIssue({ code: "custom", path: ["to"], message: "O fim precisa ser depois do início." });
    }
    if (r.kind === "ANTECEDENCIA" && r.maxDaysAhead === undefined) ctx.addIssue({ code: "custom", path: ["maxDaysAhead"], message: "Informe quantos dias antes." });
  });

export function paramsFor(r: z.infer<typeof ruleSchema>): Rule["params"] {
  switch (r.kind) {
    case "OCUPACAO":
      return { minOccupancy: r.minOccupancy };
    case "DIA_SEMANA":
      return { days: [...new Set(r.days)].sort() };
    case "PERIODO":
      return { from: r.from as DateStr, to: r.to as DateStr };
    case "ANTECEDENCIA":
      return { maxDaysAhead: r.maxDaysAhead };
  }
}

// Texto curto da condição (lista de regras).
export function describeRule(r: Rule, typeName: string | null): string {
  const p = r.params;
  const cond =
    r.kind === "OCUPACAO"
      ? `ocupação ≥ ${p.minOccupancy}%`
      : r.kind === "DIA_SEMANA"
        ? (p.days ?? []).map((d) => WEEKDAYS[d]).join(", ")
        : r.kind === "PERIODO"
          ? `${p.from?.split("-").reverse().join("/")} a ${p.to?.split("-").reverse().join("/")}`
          : `faltando até ${p.maxDaysAhead} dia(s)`;
  return typeName ? `${cond} · só ${typeName}` : cond;
}
