import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/dal";
import { getHotelSettings } from "@/lib/settings";
import { getDict } from "@/lib/i18n/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { makeT, type TFunction } from "@/lib/i18n/translate";

// Cookie do idioma para quem ainda não entrou (tela de login).
export const LOCALE_COOKIE = "hotel_locale";

// Idioma desta requisição: o escolhido no perfil do funcionário; senão o
// marcado na tela de login (PT · EN · ES); senão o padrão do hotel.
export const getLocale = cache(async (): Promise<Locale> => {
  const db = getDb();
  const session = await getCurrentSession();
  if (session) {
    const u = await db.user.findUnique({ where: { id: session.user.id }, select: { locale: true } });
    if (isLocale(u?.locale)) return u.locale;
  }
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return (await getHotelSettings(db)).defaultLocale;
});

// Guarda o idioma já descoberto nesta requisição, para componentes do
// servidor que não podem esperar (síncronos).
const store = cache(() => ({ locale: "pt-BR" as Locale }));

export async function getT(): Promise<TFunction> {
  const locale = await getLocale();
  store().locale = locale;
  return makeT(getDict(locale));
}

export function tServer(): TFunction {
  return makeT(getDict(store().locale));
}
