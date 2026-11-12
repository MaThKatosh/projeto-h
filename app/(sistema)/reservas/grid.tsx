import Link from "next/link";
import { addDays, formatDate, isWeekend, nightsBetween, weekday, type DateStr } from "@/lib/dates";
import { STATUS } from "@/lib/reservations/rules";
import type { ReservationRow } from "@/lib/reservations/service";

import { tServer } from "@/lib/i18n/server";
type Grid = {
  from: DateStr;
  days: number;
  rooms: { id: string; number: string; floor: number; roomTypeId: string; typeName: string; blocked: boolean }[];
  reservations: ReservationRow[];
};

// Mapa de reservas: uma linha por quarto, uma coluna por noite. Cada
// reserva é uma barra. Reservas ainda sem quarto ficam numa linha
// "sem quarto" do tipo delas, empilhadas se for preciso.

const HALF = "1.625rem"; // cada dia = 2 metades (manhã | tarde)
const HEAD = "7rem";

export function ReservationGrid({ grid, today }: { grid: Grid; today: DateStr }) {
  const tr = tServer();
  const dates = Array.from({ length: grid.days }, (_, i) => addDays(grid.from, i));
  const end = addDays(grid.from, grid.days);
  const types = [...new Map(grid.rooms.map((r) => [r.roomTypeId, r.typeName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));

  const template = `${HEAD} repeat(${grid.days * 2}, ${HALF})`;

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-max text-xs">
        {/* Cabeçalho de datas */}
        <div className="sticky top-0 z-10 grid border-b border-zinc-200 bg-white" style={{ gridTemplateColumns: template }}>
          <div className="sticky left-0 bg-white px-2 py-2 font-semibold">{tr("Quarto")}</div>
          {dates.map((d) => (
            <div key={d} style={{ gridColumn: "span 2" }} className={`border-l border-zinc-100 py-1 text-center ${d === today ? "bg-blue-600 text-white" : isWeekend(d) ? "bg-zinc-50" : ""}`}>
              <div className="font-semibold">{formatDate(d)}</div>
              <div className="opacity-70">{tr(weekday(d))}</div>
            </div>
          ))}
        </div>

        {types.map(([typeId, typeName]) => {
          const rooms = grid.rooms
            .filter((r) => r.roomTypeId === typeId)
            .sort((a, b) => a.number.localeCompare(b.number, "pt-BR", { numeric: true }));
          const unassigned = grid.reservations.filter((r) => !r.roomId && r.roomTypeId === typeId);
          const lanes = packLanes(unassigned);

          return (
            <div key={typeId}>
              <div className="sticky left-0 bg-zinc-100 px-2 py-1 font-semibold text-zinc-600">{typeName}</div>
              {lanes.map((lane, i) => (
                <Row key={`u${i}`} template={template} label={<span className="text-amber-700">{tr("sem quarto")}</span>} dates={dates} today={today}>
                  {lane.map((r) => <Bar key={r.id} r={r} from={grid.from} end={end} />)}
                </Row>
              ))}
              {rooms.map((room) => (
                <Row
                  key={room.id}
                  template={template}
                  label={
                    <span>
                      <b className="text-sm">{room.number}</b> {room.blocked && <span title={tr("Bloqueado")}>⛔</span>}
                    </span>
                  }
                  dates={dates}
                  today={today}
                  blocked={room.blocked}
                >
                  {grid.reservations.filter((r) => r.roomId === room.id).map((r) => <Bar key={r.id} r={r} from={grid.from} end={end} />)}
                </Row>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({
  template,
  label,
  dates,
  today,
  blocked,
  children,
}: {
  template: string;
  label: React.ReactNode;
  dates: DateStr[];
  today: DateStr;
  blocked?: boolean;
  children: React.ReactNode;
}) {
  const tr = tServer();
  return (
    <div className="relative grid h-9 border-b border-zinc-100" style={{ gridTemplateColumns: template }}>
      <div className="sticky left-0 z-[5] flex items-center bg-white px-2">{tr(label)}</div>
      {dates.map((d, i) => (
        <div
          key={d}
          className={`border-l border-zinc-100 ${d === today ? "bg-blue-50" : isWeekend(d) ? "bg-zinc-50" : ""} ${blocked ? "bg-[repeating-linear-gradient(45deg,#e4e4e7_0,#e4e4e7_4px,transparent_4px,transparent_8px)]" : ""}`}
          style={{ gridColumn: `${2 + i * 2} / span 2`, gridRow: 1 }}
        />
      ))}
      {children}
    </div>
  );
}

// Barra da reserva: começa no meio da noite de entrada e termina no meio
// do dia de saída (como nos sistemas de hotel: saída e entrada no mesmo dia
// não se sobrepõem).
function Bar({ r, from, end }: { r: ReservationRow; from: DateStr; end: DateStr }) {
  const tr = tServer();
  // Linha da grade: dia i ocupa as colunas 2+2i (manhã) e 3+2i (tarde).
  const startLine = r.checkIn < from ? 2 : 3 + 2 * nightsBetween(from, r.checkIn);
  const endLine = r.checkOut > end ? 2 + 2 * nightsBetween(from, end) : 3 + 2 * nightsBetween(from, r.checkOut);
  return (
    <Link
      href={`/reservas/${r.id}`}
      title={tr("nº {0} · {1} · {2} → {3} · {4}", [r.number, r.guestName, formatDate(r.checkIn), formatDate(r.checkOut), tr(STATUS[r.status].label)])}
      className={`relative z-[1] mx-[3px] my-1 flex items-center truncate rounded-md px-1.5 font-semibold shadow-sm hover:ring-2 hover:ring-blue-400 ${STATUS[r.status].bar}`}
      style={{ gridColumn: `${startLine} / ${endLine}`, gridRow: 1 }}
    >
      {r.guestName.split(" ")[0]} {r.guestName.split(" ").slice(-1)[0] !== r.guestName.split(" ")[0] ? r.guestName.split(" ").slice(-1)[0] : ""}
    </Link>
  );
}

// Empilha reservas sem quarto em linhas, sem sobrepor.
function packLanes(list: ReservationRow[]): ReservationRow[][] {
  const lanes: ReservationRow[][] = [];
  for (const r of [...list].sort((a, b) => a.checkIn.localeCompare(b.checkIn))) {
    const lane = lanes.find((l) => l[l.length - 1].checkOut <= r.checkIn);
    if (lane) lane.push(r);
    else lanes.push([r]);
  }
  return lanes;
}
