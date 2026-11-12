import type { Metadata } from "next";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { getHotelSettings } from "@/lib/settings";
import { guestPage } from "@/lib/requests/service";
import { I18nProvider } from "@/components/i18n";
import { getDict } from "@/lib/i18n/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { makeT } from "@/lib/i18n/translate";
import { GuestRequestScreen } from "./screen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Idioma: o escolhido nos botões (?l=) ou o do celular do hóspede.
async function guestLocale(l?: string): Promise<Locale> {
  if (isLocale(l)) return l;
  const accept = ((await headers()).get("accept-language") ?? "").toLowerCase();
  if (accept.startsWith("en")) return "en";
  if (accept.startsWith("es")) return "es";
  return "pt-BR";
}

// Página aberta pelo QR code do quarto (sem login).
export default async function HospedePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ l?: string }> }) {
  const { token } = await params;
  const { l } = await searchParams;
  const locale = await guestLocale(l);
  const tr = makeT(getDict(locale));
  const db = getDb();
  const [page, settings] = await Promise.all([guestPage(db, token), getHotelSettings(db)]);

  return (
    <I18nProvider locale={locale} dict={getDict(locale)}>
      <main className="min-h-screen bg-gradient-to-br from-blue-700 to-indigo-900 px-4 py-6">
        <div className="mx-auto max-w-md space-y-4">
          <div className="text-center text-white">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-black text-blue-700">H</div>
            <div className="text-sm opacity-80">{settings.hotelName}</div>
            {page && <h1 className="text-2xl font-bold">{tr("Quarto {0}", [page.number])}</h1>}
            <div className="mt-2 flex justify-center gap-1 text-xs">
              {(["pt-BR", "en", "es"] as const).map((x) => (
                <a key={x} href={`?l=${x}`} className={`rounded px-2 py-0.5 ${x === locale ? "bg-white text-blue-700" : "text-white/80"}`}>
                  {x === "pt-BR" ? "PT" : x.toUpperCase()}
                </a>
              ))}
            </div>
          </div>
          {!page ? (
            <div className="rounded-2xl bg-white p-6 text-center">{tr("Código do quarto inválido. Fale com a recepção.")}</div>
          ) : !page.occupied ? (
            <div className="rounded-2xl bg-white p-6 text-center">{tr("Este quarto não está com hóspede no momento. Fale com a recepção.")}</div>
          ) : (
            <GuestRequestScreen token={token} requests={page.requests} />
          )}
        </div>
      </main>
    </I18nProvider>
  );
}
