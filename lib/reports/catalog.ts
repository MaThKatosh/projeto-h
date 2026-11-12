import { addDays, fromDateStr, nightsBetween, toDateStr } from "@/lib/dates";
import { CATEGORY_LABEL, METHOD, type Category, type Method } from "@/lib/folio/rules";
import { SOURCE_LABEL, type Source } from "@/lib/reservations/rules";
import { ROLE_LABEL } from "@/lib/permissions";
import { localDayStr, localStart, type ReportDef, type ReportParams } from "@/lib/reports/engine";

// ================================================================
// CATÁLOGO DE RELATÓRIOS
// ================================================================

const ALL_FRONT = ["ADMIN", "GERENTE", "RECEPCAO"] as const;
const MANAGEMENT = ["ADMIN", "GERENTE"] as const;

// Período por data do sistema (campos @db.Date).
const byBusinessDate = (p: ReportParams) => ({ gte: fromDateStr(p.from), lte: fromDateStr(p.to) });
// Período por data e hora (campos com horário).
const byTimestamp = (p: ReportParams) => ({ gte: localStart(p.from), lt: localStart(addDays(p.to, 1)) });

const methodOptions = (Object.keys(METHOD) as Method[]).map((m) => ({ value: m, label: METHOD[m].label }));

export const REPORTS: ReportDef[] = [
  // ------------------------------------------------------------ RECEPÇÃO
  {
    slug: "hospedes-na-casa",
    title: "Hóspedes na casa",
    description: "Quem está hospedado agora: quarto, titular, acompanhantes, pessoas, saída e saldo da conta.",
    group: "Recepção",
    roles: [...ALL_FRONT],
    period: "none",
    async run(db) {
      const rows = await db.reservation.findMany({
        where: { status: "HOSPEDADA" },
        select: {
          number: true,
          adults: true,
          children: true,
          checkIn: true,
          checkOut: true,
          breakfast: true,
          guest: { select: { fullName: true, phone: true } },
          room: { select: { number: true } },
          companions: { select: { guest: { select: { fullName: true } } } },
          vehicles: { where: { exitedAt: null }, select: { plate: true } },
          folio: { select: { kind: true, amountCents: true } },
        },
      });
      const data = rows
        .map((r) => ({
          quarto: r.room?.number ?? "",
          hospede: r.guest.fullName,
          acompanhantes: r.companions.map((c) => c.guest.fullName).join(", ") || null,
          pessoas: r.adults + r.children,
          entrada: toDateStr(r.checkIn),
          saida: toDateStr(r.checkOut),
          cafe: r.breakfast ? "sim" : "não",
          veiculo: r.vehicles.map((v) => v.plate).join(", ") || null,
          telefone: r.guest.phone,
          saldo: r.folio.reduce((s, e) => s + (e.kind === "COBRANCA" ? e.amountCents : -e.amountCents), 0),
          reserva: r.number,
        }))
        .sort((a, b) => a.quarto.localeCompare(b.quarto, "pt-BR", { numeric: true }));
      return {
        columns: [
          { key: "quarto", label: "Quarto" },
          { key: "hospede", label: "Hóspede" },
          { key: "acompanhantes", label: "Acompanhantes" },
          { key: "pessoas", label: "Pessoas", type: "int", total: true },
          { key: "entrada", label: "Entrada", type: "date" },
          { key: "saida", label: "Saída", type: "date" },
          { key: "cafe", label: "Café" },
          { key: "veiculo", label: "Veículo" },
          { key: "telefone", label: "Telefone" },
          { key: "saldo", label: "Saldo da conta", type: "money", total: true },
          { key: "reserva", label: "Reserva" },
        ],
        rows: data,
        summary: [{ label: "Quartos ocupados", value: String(data.length) }],
      };
    },
  },
  {
    slug: "cafe-da-manha",
    title: "Lista do café da manhã",
    description: "Para a cozinha: quartos com café incluso na manhã escolhida (quem dormiu a noite anterior), com número de pessoas.",
    group: "Recepção",
    roles: ["ADMIN", "GERENTE", "RECEPCAO", "RESTAURANTE"],
    period: "day",
    defaultPeriod: "tomorrow",
    async run(db, p) {
      // Manhã do dia D = quem passou a noite de D-1 (entrada <= D-1 < saída).
      const night = fromDateStr(addDays(p.from, -1));
      const rows = await db.reservation.findMany({
        where: { status: { in: ["CONFIRMADA", "HOSPEDADA"] }, breakfast: true, checkIn: { lte: night }, checkOut: { gt: night } },
        select: {
          status: true,
          adults: true,
          children: true,
          checkOut: true,
          guest: { select: { fullName: true } },
          room: { select: { number: true } },
          roomType: { select: { name: true } },
        },
      });
      const data = rows
        .map((r) => ({
          quarto: r.room?.number ?? "(sem quarto)",
          hospede: r.guest.fullName,
          adultos: r.adults,
          criancas: r.children,
          obs: [toDateStr(r.checkOut) === p.from ? "sai neste dia" : null, r.status === "CONFIRMADA" ? "ainda não fez check-in" : null].filter(Boolean).join(" · ") || null,
        }))
        .sort((a, b) => a.quarto.localeCompare(b.quarto, "pt-BR", { numeric: true }));
      return {
        columns: [
          { key: "quarto", label: "Quarto" },
          { key: "hospede", label: "Hóspede" },
          { key: "adultos", label: "Adultos", type: "int", total: true },
          { key: "criancas", label: "Crianças", type: "int", total: true },
          { key: "obs", label: "Observação" },
        ],
        rows: data,
        summary: [{ label: "Pessoas no café", value: String(data.reduce((s, r) => s + r.adultos + r.criancas, 0)) }],
        note: "Inclui reservas confirmadas que deveriam ter chegado: confira antes de passar à cozinha.",
      };
    },
  },
  {
    slug: "check-ins",
    title: "Check-ins",
    description: "Entradas feitas no período, com quarto, origem e diária.",
    group: "Recepção",
    roles: [...ALL_FRONT],
    period: "range",
    defaultPeriod: "today",
    async run(db, p) {
      const rows = await db.reservation.findMany({
        where: { checkedInAt: byTimestamp(p) },
        orderBy: { checkedInAt: "asc" },
        select: { number: true, checkedInAt: true, checkOut: true, checkIn: true, adults: true, children: true, source: true, dailyCents: true, guest: { select: { fullName: true } }, room: { select: { number: true } } },
      });
      return {
        columns: [
          { key: "quando", label: "Check-in", type: "datetime" },
          { key: "quarto", label: "Quarto" },
          { key: "hospede", label: "Hóspede" },
          { key: "pessoas", label: "Pessoas", type: "int", total: true },
          { key: "noites", label: "Noites", type: "int", total: true },
          { key: "origem", label: "Origem" },
          { key: "diaria", label: "Diária", type: "money" },
          { key: "reserva", label: "Reserva" },
        ],
        rows: rows.map((r) => ({
          quando: r.checkedInAt!.toISOString(),
          quarto: r.room?.number ?? "",
          hospede: r.guest.fullName,
          pessoas: r.adults + r.children,
          noites: nightsBetween(toDateStr(r.checkIn), toDateStr(r.checkOut)),
          origem: SOURCE_LABEL[r.source as Source],
          diaria: r.dailyCents,
          reserva: r.number,
        })),
      };
    },
  },
  {
    slug: "check-outs",
    title: "Check-outs",
    description: "Saídas feitas no período, com o total da conta.",
    group: "Recepção",
    roles: [...ALL_FRONT],
    period: "range",
    defaultPeriod: "today",
    async run(db, p) {
      const rows = await db.reservation.findMany({
        where: { checkedOutAt: byTimestamp(p) },
        orderBy: { checkedOutAt: "asc" },
        select: {
          number: true,
          checkedOutAt: true,
          checkIn: true,
          checkOut: true,
          guest: { select: { fullName: true } },
          room: { select: { number: true } },
          folio: { where: { kind: "COBRANCA" }, select: { amountCents: true } },
        },
      });
      return {
        columns: [
          { key: "quando", label: "Check-out", type: "datetime" },
          { key: "quarto", label: "Quarto" },
          { key: "hospede", label: "Hóspede" },
          { key: "noites", label: "Noites", type: "int", total: true },
          { key: "total", label: "Total da conta", type: "money", total: true },
          { key: "reserva", label: "Reserva" },
        ],
        rows: rows.map((r) => ({
          quando: r.checkedOutAt!.toISOString(),
          quarto: r.room?.number ?? "",
          hospede: r.guest.fullName,
          noites: nightsBetween(toDateStr(r.checkIn), toDateStr(r.checkOut)),
          total: r.folio.reduce((s, e) => s + e.amountCents, 0),
          reserva: r.number,
        })),
      };
    },
  },
  {
    slug: "mudancas-de-quarto",
    title: "Mudanças de quarto",
    description: "Trocas de quarto de hóspedes na casa: de qual para qual, motivo e quem fez.",
    group: "Recepção",
    roles: [...ALL_FRONT],
    period: "range",
    defaultPeriod: "last7",
    async run(db, p) {
      const rows = await db.roomMove.findMany({
        where: { createdAt: byTimestamp(p) },
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          reason: true,
          fromRoom: { select: { number: true } },
          toRoom: { select: { number: true } },
          user: { select: { fullName: true } },
          reservation: { select: { number: true, guest: { select: { fullName: true } } } },
        },
      });
      return {
        columns: [
          { key: "quando", label: "Quando", type: "datetime" },
          { key: "hospede", label: "Hóspede" },
          { key: "de", label: "De" },
          { key: "para", label: "Para" },
          { key: "motivo", label: "Motivo" },
          { key: "por", label: "Feita por" },
          { key: "reserva", label: "Reserva" },
        ],
        rows: rows.map((r) => ({
          quando: r.createdAt.toISOString(),
          hospede: r.reservation.guest.fullName,
          de: r.fromRoom.number,
          para: r.toRoom.number,
          motivo: r.reason,
          por: r.user?.fullName ?? "—",
          reserva: r.reservation.number,
        })),
      };
    },
  },
  {
    slug: "chegadas-previstas",
    title: "Chegadas previstas",
    description: "Reservas confirmadas com entrada no período (para preparar quartos e conferir dados).",
    group: "Recepção",
    roles: [...ALL_FRONT],
    period: "range",
    defaultPeriod: "tomorrow",
    async run(db, p) {
      const rows = await db.reservation.findMany({
        where: { status: "CONFIRMADA", checkIn: byBusinessDate(p) },
        orderBy: { checkIn: "asc" },
        select: { number: true, checkIn: true, checkOut: true, adults: true, children: true, source: true, notes: true, guest: { select: { fullName: true, phone: true } }, roomType: { select: { name: true } }, room: { select: { number: true } } },
      });
      return {
        columns: [
          { key: "entrada", label: "Entrada", type: "date" },
          { key: "hospede", label: "Hóspede" },
          { key: "tipo", label: "Tipo" },
          { key: "quarto", label: "Quarto" },
          { key: "pessoas", label: "Pessoas", type: "int", total: true },
          { key: "noites", label: "Noites", type: "int" },
          { key: "origem", label: "Origem" },
          { key: "telefone", label: "Telefone" },
          { key: "obs", label: "Observação" },
        ],
        rows: rows.map((r) => ({
          entrada: toDateStr(r.checkIn),
          hospede: r.guest.fullName,
          tipo: r.roomType.name,
          quarto: r.room?.number ?? null,
          pessoas: r.adults + r.children,
          noites: nightsBetween(toDateStr(r.checkIn), toDateStr(r.checkOut)),
          origem: SOURCE_LABEL[r.source as Source],
          telefone: r.guest.phone,
          obs: r.notes,
        })),
      };
    },
  },
  {
    slug: "no-shows-e-cancelamentos",
    title: "Não comparecimentos e cancelamentos",
    description: "Reservas marcadas como não compareceu ou canceladas no período, com o motivo.",
    group: "Recepção",
    roles: [...ALL_FRONT],
    period: "range",
    defaultPeriod: "month",
    async run(db, p) {
      const ev = await db.reservationEvent.findMany({
        where: { type: { in: ["cancelada", "no_show"] }, createdAt: byTimestamp(p) },
        orderBy: { createdAt: "asc" },
        select: { type: true, message: true, createdAt: true, user: { select: { fullName: true } }, reservation: { select: { number: true, checkIn: true, source: true, guest: { select: { fullName: true } } } } },
      });
      return {
        columns: [
          { key: "quando", label: "Quando", type: "datetime" },
          { key: "tipo", label: "Tipo" },
          { key: "hospede", label: "Hóspede" },
          { key: "entrada", label: "Entrada prevista", type: "date" },
          { key: "origem", label: "Origem" },
          { key: "motivo", label: "Motivo" },
          { key: "por", label: "Por" },
        ],
        rows: ev.map((e) => ({
          quando: e.createdAt.toISOString(),
          tipo: e.type === "no_show" ? "Não compareceu" : "Cancelada",
          hospede: e.reservation.guest.fullName,
          entrada: toDateStr(e.reservation.checkIn),
          origem: SOURCE_LABEL[e.reservation.source as Source],
          motivo: e.message,
          por: e.user?.fullName ?? "—",
        })),
      };
    },
  },

  // ------------------------------------------------------------ FINANCEIRO
  {
    slug: "bordero",
    title: "Borderô por forma de pagamento",
    description: "Todos os recebimentos (quartos e restaurante) no período, por forma: crédito, débito, Pix, dinheiro e transferência. Filtre por uma forma.",
    group: "Financeiro",
    roles: [...ALL_FRONT],
    period: "range",
    defaultPeriod: "today",
    filter: { label: "Forma de pagamento", options: methodOptions },
    async run(db, p) {
      const method = p.filter as Method | undefined;
      const [folio, pos] = await Promise.all([
        db.folioEntry.findMany({
          where: { kind: "PAGAMENTO", businessDate: byBusinessDate(p), ...(method ? { method } : {}) },
          orderBy: { createdAt: "asc" },
          select: { businessDate: true, createdAt: true, method: true, cardBrand: true, amountCents: true, reference: true, installments: true, description: true, createdBy: { select: { fullName: true } }, reservation: { select: { number: true, room: { select: { number: true } }, guest: { select: { fullName: true } } } } },
        }),
        db.posPayment.findMany({
          where: { businessDate: byBusinessDate(p), ...(method ? { method } : {}) },
          orderBy: { createdAt: "asc" },
          select: { businessDate: true, createdAt: true, method: true, cardBrand: true, amountCents: true, reference: true, createdBy: { select: { fullName: true } }, comanda: { select: { number: true } } },
        }),
      ]);
      const rows = [
        ...folio.map((f) => ({
          dia: toDateStr(f.businessDate),
          hora: f.createdAt.toISOString(),
          forma: METHOD[f.method as Method].label,
          origem: `Quarto ${f.reservation.room?.number ?? "—"} · ${f.reservation.guest.fullName}`,
          detalhe: f.description + (f.installments && f.installments > 1 ? ` (${f.installments}x)` : ""),
          bandeira: f.cardBrand,
          referencia: f.reference,
          por: f.createdBy?.fullName ?? "—",
          valor: f.amountCents,
        })),
        ...pos.map((x) => ({
          dia: toDateStr(x.businessDate),
          hora: x.createdAt.toISOString(),
          forma: METHOD[x.method as Method].label,
          origem: `Restaurante comanda nº ${x.comanda.number}`,
          detalhe: "Pagamento no restaurante",
          bandeira: x.cardBrand,
          referencia: x.reference,
          por: x.createdBy?.fullName ?? "—",
          valor: x.amountCents,
        })),
      ].sort((a, b) => a.hora.localeCompare(b.hora));
      const byMethod = (Object.keys(METHOD) as Method[])
        .map((m) => ({ m, v: rows.filter((r) => r.forma === METHOD[m].label).reduce((s, r) => s + r.valor, 0) }))
        .filter((x) => x.v !== 0);
      return {
        columns: [
          { key: "dia", label: "Dia", type: "date" },
          { key: "hora", label: "Lançado em", type: "datetime" },
          { key: "forma", label: "Forma" },
          { key: "origem", label: "Origem" },
          { key: "detalhe", label: "Detalhe" },
          { key: "bandeira", label: "Bandeira" },
          { key: "referencia", label: "NSU / ID" },
          { key: "por", label: "Recebido por" },
          { key: "valor", label: "Valor", type: "money", total: true },
        ],
        rows,
        summary: [
          ...byMethod.map((x) => ({ label: METHOD[x.m].label, value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(x.v / 100) })),
          // Cartões por bandeira (para conferir com o extrato da maquininha).
          ...[...new Set(rows.filter((r) => r.bandeira).map((r) => r.bandeira as string))].map((b) => ({
            label: `Cartão ${b}`,
            value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(rows.filter((r) => r.bandeira === b).reduce((s2, r) => s2 + r.valor, 0) / 100),
          })),
        ],
        note: "Estornos e devoluções aparecem com valor negativo.",
      };
    },
  },
  {
    slug: "caixa-por-funcionario",
    title: "Caixa por funcionário",
    description: "Quanto cada funcionário recebeu no período, por forma de pagamento (fechamento de turno).",
    group: "Financeiro",
    roles: [...ALL_FRONT],
    period: "range",
    defaultPeriod: "today",
    async run(db, p) {
      const [folio, pos] = await Promise.all([
        db.folioEntry.findMany({ where: { kind: "PAGAMENTO", businessDate: byBusinessDate(p) }, select: { method: true, amountCents: true, createdBy: { select: { fullName: true } } } }),
        db.posPayment.findMany({ where: { businessDate: byBusinessDate(p) }, select: { method: true, amountCents: true, createdBy: { select: { fullName: true } } } }),
      ]);
      const map = new Map<string, Record<string, number>>();
      for (const e of [...folio, ...pos]) {
        const who = e.createdBy?.fullName ?? "Sistema";
        const row = map.get(who) ?? {};
        const m = e.method ?? "DINHEIRO"; // pagamento sempre tem forma (regra do banco)
        row[m] = (row[m] ?? 0) + e.amountCents;
        map.set(who, row);
      }
      const methods = Object.keys(METHOD) as Method[];
      return {
        columns: [
          { key: "funcionario", label: "Funcionário" },
          ...methods.map((m) => ({ key: m, label: METHOD[m].label, type: "money" as const, total: true })),
          { key: "total", label: "Total", type: "money", total: true },
        ],
        rows: [...map.entries()].map(([who, v]) => ({
          funcionario: who,
          ...Object.fromEntries(methods.map((m) => [m, v[m] ?? 0])),
          total: methods.reduce((s, m) => s + (v[m] ?? 0), 0),
        })),
      };
    },
  },
  {
    slug: "receitas",
    title: "Receitas por tipo",
    description: "Cobranças lançadas no período, dia a dia, por tipo: diárias, ISS, estacionamento, restaurante, frigobar e outros.",
    group: "Financeiro",
    roles: [...MANAGEMENT],
    period: "range",
    defaultPeriod: "last7",
    async run(db, p) {
      const rows = await db.folioEntry.groupBy({
        by: ["businessDate", "category"],
        where: { kind: "COBRANCA", businessDate: byBusinessDate(p) },
        _sum: { amountCents: true },
      });
      const cats = [...new Set(rows.map((r) => r.category!))] as Category[];
      const days = [...new Set(rows.map((r) => toDateStr(r.businessDate)))].sort();
      return {
        columns: [
          { key: "dia", label: "Dia", type: "date" },
          ...cats.map((c) => ({ key: c, label: CATEGORY_LABEL[c], type: "money" as const, total: true })),
          { key: "total", label: "Total", type: "money", total: true },
        ],
        rows: days.map((d) => {
          const line: Record<string, string | number> = { dia: d };
          let t = 0;
          for (const c of cats) {
            const v = rows.find((r) => toDateStr(r.businessDate) === d && r.category === c)?._sum.amountCents ?? 0;
            line[c] = v;
            t += v;
          }
          line.total = t;
          return line;
        }),
      };
    },
  },
  {
    slug: "estornos",
    title: "Estornos e devoluções",
    description: "Todo lançamento estornado ou devolvido no período: o quê, quanto, por quem e por quê.",
    group: "Financeiro",
    roles: [...MANAGEMENT],
    period: "range",
    defaultPeriod: "month",
    async run(db, p) {
      const rows = await db.folioEntry.findMany({
        where: { businessDate: byBusinessDate(p), OR: [{ reversalOfId: { not: null } }, { isRefund: true }] },
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          description: true,
          amountCents: true,
          isRefund: true,
          createdBy: { select: { fullName: true } },
          reversalOf: { select: { reverseReason: true, createdAt: true, createdBy: { select: { fullName: true } } } },
          reservation: { select: { number: true, room: { select: { number: true } }, guest: { select: { fullName: true } } } },
        },
      });
      return {
        columns: [
          { key: "quando", label: "Quando", type: "datetime" },
          { key: "tipo", label: "Tipo" },
          { key: "quarto", label: "Quarto" },
          { key: "hospede", label: "Hóspede" },
          { key: "lancamento", label: "Lançamento" },
          { key: "motivo", label: "Motivo" },
          { key: "original", label: "Lançado originalmente por" },
          { key: "por", label: "Estornado por" },
          { key: "valor", label: "Valor", type: "money", total: true },
        ],
        rows: rows.map((r) => ({
          quando: r.createdAt.toISOString(),
          tipo: r.isRefund && !r.reversalOf ? "Devolução" : "Estorno",
          quarto: r.reservation.room?.number ?? "",
          hospede: r.reservation.guest.fullName,
          lancamento: r.description,
          motivo: r.reversalOf?.reverseReason ?? null,
          original: r.reversalOf?.createdBy?.fullName ?? null,
          por: r.createdBy?.fullName ?? "—",
          valor: r.amountCents,
        })),
      };
    },
  },

  // ------------------------------------------------------------ GOVERNANÇA E MANUTENÇÃO
  {
    slug: "arrumacoes",
    title: "Arrumações por camareira",
    description: "Quartos arrumados no período por pessoa, com tempo médio.",
    group: "Governança e manutenção",
    roles: ["ADMIN", "GERENTE", "GOVERNANCA"],
    period: "range",
    defaultPeriod: "today",
    async run(db, p) {
      const rows = await db.cleaningTask.findMany({
        where: { status: "CONCLUIDA", finishedAt: byTimestamp(p) },
        select: { startedAt: true, finishedAt: true, finishedBy: { select: { fullName: true } }, assignedTo: { select: { fullName: true } } },
      });
      const map = new Map<string, { n: number; mins: number[] }>();
      for (const r of rows) {
        const who = r.assignedTo?.fullName ?? r.finishedBy?.fullName ?? "Sem nome";
        const e = map.get(who) ?? { n: 0, mins: [] };
        e.n++;
        if (r.startedAt && r.finishedAt) e.mins.push((r.finishedAt.getTime() - r.startedAt.getTime()) / 60000);
        map.set(who, e);
      }
      return {
        columns: [
          { key: "pessoa", label: "Camareira" },
          { key: "quartos", label: "Quartos arrumados", type: "int", total: true },
          { key: "media", label: "Tempo médio (min)", type: "int" },
        ],
        rows: [...map.entries()].map(([pessoa, e]) => ({
          pessoa,
          quartos: e.n,
          media: e.mins.length ? Math.round(e.mins.reduce((s, x) => s + x, 0) / e.mins.length) : null,
        })),
      };
    },
  },
  {
    slug: "ocorrencias",
    title: "Ocorrências de manutenção",
    description: "Problemas abertos no período, com situação, prioridade, local e solução.",
    group: "Governança e manutenção",
    roles: ["ADMIN", "GERENTE", "MANUTENCAO"],
    period: "range",
    defaultPeriod: "month",
    async run(db, p) {
      const rows = await db.maintenanceTicket.findMany({
        where: { createdAt: byTimestamp(p) },
        orderBy: { createdAt: "asc" },
        select: { number: true, title: true, status: true, priority: true, location: true, outOfOrder: true, createdAt: true, closedAt: true, resolution: true, room: { select: { number: true } }, assignedTo: { select: { fullName: true } } },
      });
      return {
        columns: [
          { key: "numero", label: "Nº" },
          { key: "aberta", label: "Aberta em", type: "datetime" },
          { key: "local", label: "Local" },
          { key: "titulo", label: "Problema" },
          { key: "prioridade", label: "Prioridade" },
          { key: "situacao", label: "Situação" },
          { key: "responsavel", label: "Responsável" },
          { key: "horas", label: "Horas até fechar", type: "int" },
          { key: "solucao", label: "Solução" },
        ],
        rows: rows.map((r) => ({
          numero: r.number,
          aberta: r.createdAt.toISOString(),
          local: r.room ? `Quarto ${r.room.number}` : r.location,
          titulo: r.title + (r.outOfOrder ? " (fora de venda)" : ""),
          prioridade: r.priority.charAt(0) + r.priority.slice(1).toLowerCase(),
          situacao: r.status.replace("_", " ").toLowerCase(),
          responsavel: r.assignedTo?.fullName ?? null,
          horas: r.closedAt ? Math.round((r.closedAt.getTime() - r.createdAt.getTime()) / 3_600_000) : null,
          solucao: r.resolution,
        })),
      };
    },
  },

  // ------------------------------------------------------------ RESTAURANTE E FRIGOBAR
  {
    slug: "vendas-restaurante",
    title: "Vendas do restaurante por item",
    description: "Itens vendidos em comandas fechadas no período: quantidade e valor (sem a taxa de serviço).",
    group: "Restaurante e frigobar",
    roles: ["ADMIN", "GERENTE", "RESTAURANTE"],
    period: "range",
    defaultPeriod: "last7",
    async run(db, p) {
      const items = await db.comandaItem.findMany({
        where: { status: { not: "CANCELADO" }, comanda: { status: "FECHADA", closedAt: byTimestamp(p) } },
        select: { name: true, quantity: true, unitCents: true },
      });
      const comandas = await db.comanda.findMany({ where: { status: "FECHADA", closedAt: byTimestamp(p) }, select: { totalCents: true, settlement: true } });
      const map = new Map<string, { q: number; v: number }>();
      for (const i of items) {
        const e = map.get(i.name) ?? { q: 0, v: 0 };
        e.q += i.quantity;
        e.v += i.quantity * i.unitCents;
        map.set(i.name, e);
      }
      const brl = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
      return {
        columns: [
          { key: "item", label: "Item" },
          { key: "quantidade", label: "Quantidade", type: "int", total: true },
          { key: "valor", label: "Valor", type: "money", total: true },
        ],
        rows: [...map.entries()].map(([item, e]) => ({ item, quantidade: e.q, valor: e.v })).sort((a, b) => b.valor - a.valor),
        summary: [
          { label: "Comandas fechadas", value: String(comandas.length) },
          { label: "Total com serviço", value: brl(comandas.reduce((s, c) => s + (c.totalCents ?? 0), 0)) },
          { label: "Lançadas no quarto", value: String(comandas.filter((c) => c.settlement === "QUARTO").length) },
        ],
      };
    },
  },
  {
    slug: "frigobar",
    title: "Consumo do frigobar",
    description: "Itens do frigobar lançados no período (sem os estornados), por item e quarto.",
    group: "Restaurante e frigobar",
    roles: ["ADMIN", "GERENTE", "RECEPCAO", "GOVERNANCA"],
    period: "range",
    defaultPeriod: "today",
    async run(db, p) {
      const rows = await db.folioEntry.findMany({
        where: { category: "FRIGOBAR", businessDate: byBusinessDate(p), reversalOfId: null, reversedAt: null },
        orderBy: { createdAt: "asc" },
        select: { businessDate: true, description: true, quantity: true, amountCents: true, createdBy: { select: { fullName: true } }, reservation: { select: { room: { select: { number: true } } } } },
      });
      return {
        columns: [
          { key: "dia", label: "Dia", type: "date" },
          { key: "quarto", label: "Quarto" },
          { key: "item", label: "Item" },
          { key: "quantidade", label: "Qtd.", type: "int", total: true },
          { key: "valor", label: "Valor", type: "money", total: true },
          { key: "por", label: "Lançado por" },
        ],
        rows: rows.map((r) => ({
          dia: toDateStr(r.businessDate),
          quarto: r.reservation.room?.number ?? "",
          item: r.description.replace(/^Frigobar:\s*/, ""),
          quantidade: r.quantity,
          valor: r.amountCents,
          por: r.createdBy?.fullName ?? "—",
        })),
      };
    },
  },

  // ------------------------------------------------------------ GESTÃO
  {
    slug: "ocupacao",
    title: "Ocupação e receita por dia",
    description: "Números guardados por cada auditoria: quartos ocupados, % de ocupação, hóspedes, diária média, receita e recebido.",
    group: "Gestão",
    roles: [...MANAGEMENT],
    period: "range",
    defaultPeriod: "month",
    async run(db, p) {
      const rows = await db.auditRun.findMany({ where: { businessDate: byBusinessDate(p), undoneAt: null }, orderBy: { businessDate: "asc" } });
      return {
        columns: [
          { key: "dia", label: "Dia", type: "date" },
          { key: "ocupados", label: "Ocupados", type: "int", total: true },
          { key: "disponiveis", label: "Disponíveis", type: "int" },
          { key: "ocupacao", label: "Ocupação", type: "percent" },
          { key: "hospedes", label: "Hóspedes", type: "int", total: true },
          { key: "diariaMedia", label: "Diária média", type: "money" },
          { key: "receita", label: "Receita do dia", type: "money", total: true },
          { key: "recebido", label: "Recebido", type: "money", total: true },
        ],
        rows: rows.map((r) => ({
          dia: toDateStr(r.businessDate),
          ocupados: r.roomsOccupied,
          disponiveis: r.roomsAvailable,
          ocupacao: r.roomsAvailable ? Math.round((r.roomsOccupied / r.roomsAvailable) * 1000) / 10 : 0,
          hospedes: r.guests,
          diariaMedia: r.roomsOccupied ? Math.round(r.lodgingCents / r.roomsOccupied) : 0,
          receita: r.revenueCents,
          recebido: r.receivedCents,
        })),
        note: "Só aparecem dias em que a auditoria noturna foi rodada.",
      };
    },
  },
  {
    slug: "registro-de-acoes",
    title: "Registro de ações (auditoria do sistema)",
    description: "Tudo de sensível que aconteceu no sistema: logins, estornos, cancelamentos, mudanças de usuários e tarifas, auditorias.",
    group: "Gestão",
    roles: [...MANAGEMENT],
    period: "range",
    defaultPeriod: "today",
    filter: {
      label: "Tipo",
      options: [
        { value: "auth", label: "Logins" },
        { value: "folio", label: "Conta do quarto" },
        { value: "reservation", label: "Reservas" },
        { value: "user", label: "Usuários" },
        { value: "audit", label: "Auditoria noturna" },
        { value: "comanda", label: "Restaurante" },
      ],
    },
    async run(db, p) {
      const rows = await db.auditLog.findMany({
        where: { createdAt: byTimestamp(p), ...(p.filter ? { action: { startsWith: p.filter } } : {}) },
        orderBy: { createdAt: "desc" },
        take: 2000,
        select: { createdAt: true, action: true, ipAddress: true, metadata: true, user: { select: { fullName: true, role: true } } },
      });
      return {
        columns: [
          { key: "quando", label: "Quando", type: "datetime" },
          { key: "quem", label: "Quem" },
          { key: "cargo", label: "Cargo" },
          { key: "acao", label: "Ação" },
          { key: "detalhes", label: "Detalhes" },
          { key: "ip", label: "IP" },
        ],
        rows: rows.map((r) => ({
          quando: r.createdAt.toISOString(),
          quem: r.user?.fullName ?? "—",
          cargo: r.user ? ROLE_LABEL[r.user.role] : null,
          acao: r.action,
          detalhes: r.metadata ? JSON.stringify(r.metadata).slice(0, 200) : null,
          ip: r.ipAddress,
        })),
        note: rows.length === 2000 ? "Mostrando as 2.000 ações mais recentes do período." : undefined,
      };
    },
  },
];

export function findReport(slug: string) {
  return REPORTS.find((r) => r.slug === slug);
}

// Período padrão de cada relatório.
export function defaultRange(def: ReportDef, today: string): { from: string; to: string } {
  switch (def.defaultPeriod) {
    case "tomorrow":
      return { from: addDays(today, 1), to: addDays(today, 1) };
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
    default:
      return { from: today, to: today };
  }
}

export { localDayStr };
