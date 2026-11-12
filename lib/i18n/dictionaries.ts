import type { Dict } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locales";
import en from "@/lib/i18n/messages/en";
import es from "@/lib/i18n/messages/es";

// Português é o idioma-base (o texto do código); não precisa de dicionário.
export function getDict(locale: Locale): Dict | null {
  if (locale === "en") return en;
  if (locale === "es") return es;
  return null;
}
