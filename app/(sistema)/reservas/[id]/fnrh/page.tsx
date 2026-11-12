import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { getReservation } from "@/lib/reservations/service";
import { getHotelSettings } from "@/lib/settings";
import { GENDER_LABEL, PURPOSE_LABEL, TRANSPORT_LABEL, missingFnrh } from "@/lib/guests/fnrh";
import type { GuestView } from "@/lib/guests/service";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";
import { PrintButton } from "../../../relatorios/[slug]/print-button";

export const dynamic = "force-dynamic";

const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");

// FNRH — Ficha Nacional de Registro de Hóspedes, uma página por pessoa,
// pronta para imprimir e o hóspede assinar.
export default async function FnrhPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("reservations.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const [r, settings] = await Promise.all([getReservation(db, id), getHotelSettings(db)]);
  if (!r) notFound();
  const tr = await getT();
  const people = [r.guest, ...r.companions];
  const plates = r.vehicleList.map((v) => v.plate).join(", ");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href={`/reservas/${r.id}`} className="text-sm text-blue-700 underline">{tr("← Voltar para a reserva nº {0}", [r.number])}</Link>
        <PrintButton />
      </div>
      {people.map((g, i) => (
        <Sheet key={g.id} tr={tr} hotel={settings.hotelName} g={g} titular={i === 0} r={r} plates={plates} />
      ))}
    </div>
  );
}

function Sheet({
  tr,
  hotel,
  g,
  titular,
  r,
  plates,
}: {
  tr: TFunction;
  hotel: string;
  g: GuestView;
  titular: boolean;
  r: NonNullable<Awaited<ReturnType<typeof getReservation>>>;
  plates: string;
}) {
  const missing = missingFnrh(g);
  return (
    <section className="card break-after-page p-6 text-sm print:break-after-page">
      <header className="mb-4 flex items-start justify-between border-b border-zinc-300 pb-3">
        <div>
          <div className="text-xs tracking-wide text-zinc-500 uppercase">{hotel}</div>
          <h1 className="text-lg font-bold">{tr("Ficha Nacional de Registro de Hóspedes (FNRH)")}</h1>
        </div>
        <div className="text-right text-xs text-zinc-600">
          <div>{tr("Reserva nº {0}", [r.number])}</div>
          <div>{titular ? tr("Titular") : tr("Acompanhante")}</div>
        </div>
      </header>
      {missing.length > 0 && (
        <p className="no-print mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{tr("Ficha incompleta: {0}", [missing.map((m) => tr(m)).join(", ")])}</p>
      )}

      <Group title={tr("Hóspede")}>
        <F label={tr("Nome completo")} value={g.fullName} wide />
        <F label={tr("Nascimento")} value={br(g.birthDate)} />
        <F label={tr("Sexo")} value={g.gender ? tr(GENDER_LABEL[g.gender] ?? g.gender) : ""} />
        <F label={tr("Nacionalidade")} value={g.nationality} />
        <F label={tr("Profissão")} value={g.profession} />
        <F label={tr("Telefone")} value={g.phone} />
        <F label={tr("E-mail")} value={g.email} />
      </Group>

      <Group title={tr("Documento")}>
        <F label={tr("Tipo")} value={g.docType} />
        <F label={tr("Número")} value={g.docNumber} />
        <F label={tr("Órgão emissor / país do documento")} value={g.docIssuer} wide />
      </Group>

      <Group title={tr("Residência")}>
        <F label={tr("Endereço (rua, número, bairro)")} value={g.address} wide />
        <F label={tr("Cidade")} value={g.city} />
        <F label={tr("Estado")} value={g.state} />
        <F label={tr("CEP")} value={g.zipCode} />
        <F label={tr("País de residência")} value={g.country} />
      </Group>

      <Group title={tr("Viagem")}>
        <F label={tr("Motivo da viagem")} value={r.trip.travelPurpose ? tr(PURPOSE_LABEL[r.trip.travelPurpose]) : ""} />
        <F label={tr("Meio de transporte")} value={r.trip.transport ? tr(TRANSPORT_LABEL[r.trip.transport]) : ""} />
        <F label={tr("Vem de (cidade/UF/país)")} value={r.trip.arrivingFrom} />
        <F label={tr("Próximo destino")} value={r.trip.nextDestination} />
        <F label={tr("Placa do veículo")} value={plates} />
      </Group>

      <Group title={tr("Estadia")}>
        <F label={tr("Entrada")} value={br(r.checkIn)} />
        <F label={tr("Saída prevista")} value={br(r.checkOut)} />
        <F label={tr("Quarto")} value={r.roomNumber} />
        <F label={tr("Hóspedes no quarto")} value={String(r.adults + r.children)} />
      </Group>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div className="border-t border-zinc-500 pt-1 text-center text-xs">{tr("Assinatura do hóspede")}</div>
        <div className="border-t border-zinc-500 pt-1 text-center text-xs">{tr("Recepção")}</div>
      </div>
      <p className="mt-4 text-[10px] text-zinc-500">
        {tr("Declaro que as informações acima são verdadeiras. Dados usados para o registro obrigatório de hóspedes (Lei 11.771/2008) e protegidos conforme a LGPD.")}
      </p>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="mb-1 text-xs font-bold tracking-wide text-zinc-500 uppercase">{title}</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">{children}</div>
    </div>
  );
}

function F({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className="min-h-5 border-b border-dotted border-zinc-300 font-medium">{value || " "}</div>
    </div>
  );
}
