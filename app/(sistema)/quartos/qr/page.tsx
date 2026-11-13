import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { roomToken } from "@/lib/requests/service";
import { getHotelSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n/server";
import { PrintButton } from "../../relatorios/[slug]/print-button";
import { CopyLinkButton, RotateButton } from "./rotate-button";

export const dynamic = "force-dynamic";

// Folha de QR codes: um cartão por quarto, para imprimir, recortar e colar.
export default async function QrPage() {
  const tr = await getT();
  await requirePermission("rooms.manage");
  const db = getDb();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const [rooms, settings] = await Promise.all([
    db.room.findMany({ where: { active: true }, orderBy: [{ floor: "asc" }, { number: "asc" }], select: { id: true, number: true } }),
    getHotelSettings(db),
  ]);
  const cards = [];
  for (const r of rooms) {
    const url = `${origin}/hospede/${await roomToken(db, r.id)}`;
    cards.push({ ...r, url, svg: await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) });
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/pedidos" className="text-sm text-blue-700 underline">{tr("← Pedidos dos hóspedes")}</Link>
          <h1 className="text-2xl font-bold">{tr("QR codes dos quartos")}</h1>
          <p className="max-w-2xl text-sm text-zinc-500">
            {tr("Imprima, recorte e cole cada cartão no seu quarto. O hóspede aponta a câmera e pede limpeza, toalhas ou relata um problema — só funciona enquanto o quarto está ocupado. Se um QR for copiado por alguém de fora, use “trocar código”.")}
          </p>
          {origin.includes("localhost") && (
            <p className="mt-1 max-w-2xl rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
              {tr("Atenção: você está acessando por “localhost”. Imprima pelo endereço que os celulares usam (o do servidor), senão o QR não abre no celular.")}
            </p>
          )}
        </div>
        <PrintButton />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
        {cards.map((c) => (
          <div key={c.id} data-room={c.number} data-url={c.url} className="break-inside-avoid rounded-xl border-2 border-dashed border-zinc-300 bg-white p-3 text-center">
            <div className="text-xs text-zinc-500">{settings.hotelName}</div>
            <div className="text-2xl font-black">{tr("Quarto {0}", [c.number])}</div>
            <div className="mx-auto my-2 w-36" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <div className="text-sm font-semibold">{tr("Precisa de algo? Aponte a câmera.")}</div>
            <div className="text-[10px] text-zinc-500">Need anything? Scan me · ¿Necesita algo? Escanee</div>
            <CopyLinkButton url={c.url} />
            <RotateButton roomId={c.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
