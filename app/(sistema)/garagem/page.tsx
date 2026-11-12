import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { getBusinessDate } from "@/lib/hotel-date";
import { formatDate } from "@/lib/dates";
import { garage } from "@/lib/reservations/service";
import { LiveRefresher } from "@/components/live-refresher";
import { dateTime } from "@/components/time";
import { ExitButton } from "./exit-button";

import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";

export default async function GaragemPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const tr = await getT();
  const { user } = await requirePermission("reservations.view");
  const db = getDb();
  const [cars, today, { q = "" }] = await Promise.all([garage(db), getBusinessDate(db), searchParams]);
  const term = q.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const shown = term ? cars.filter((c) => c.plate.includes(term) || c.roomNumber === q.trim()) : cars;
  const canManage = can(user.role, "reservations.manage");

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr("Garagem")}</h1>
          <LiveRefresher types={["reservations.changed"]} />
        </div>
        <div className="card px-4 py-2">
          <div className="text-xs text-zinc-500">{tr("Veículos na garagem")}</div>
          <div className="text-2xl font-bold">{cars.length}</div>
        </div>
      </div>
      <p className="text-sm text-zinc-500">{tr("Veículos entram pelo check-in ou pelo botão “Veículo” na reserva do hóspede. No check-out a saída é registrada sozinha.")}</p>
      <form className="flex gap-2" action="/garagem">
        <input name="q" defaultValue={q} className="field max-w-xs" placeholder={tr("Buscar placa ou quarto")} />
        <button className="btn-secondary">{tr("Buscar")}</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2">{tr("Placa")}</th>
              <th className="px-3 py-2">{tr("Veículo")}</th>
              <th className="px-3 py-2">{tr("Vaga")}</th>
              <th className="px-3 py-2">{tr("Quarto / hóspede")}</th>
              <th className="px-3 py-2">{tr("Entrou")}</th>
              <th className="px-3 py-2">{tr("Sai")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100">
                <td className="px-3 py-2 font-mono text-base font-bold">{c.plate}</td>
                <td className="px-3 py-2">{[c.model, c.color].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-2">{c.spot ?? "—"}</td>
                <td className="px-3 py-2">
                  <b>{c.roomNumber ?? "—"}</b>{" "}
                  <Link href={`/reservas/${c.reservationId}`} className="text-blue-700 underline">{c.guestName}</Link>
                </td>
                <td className="px-3 py-2 text-xs">{dateTime(c.enteredAt)}</td>
                <td className={`px-3 py-2 text-xs ${c.checkOut <= today ? "font-bold text-amber-700" : ""}`}>{formatDate(c.checkOut)}</td>
                <td className="px-3 py-2 text-right">{canManage && <ExitButton vehicleId={c.id} />}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">{term ? tr("Nenhum veículo com essa busca.") : tr("Garagem vazia.")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
