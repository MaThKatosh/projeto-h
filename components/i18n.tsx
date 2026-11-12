"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT, type Dict, type TFunction } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locales";

type I18n = { locale: Locale; dict: Dict | null };

const Ctx = createContext<I18n>({ locale: "pt-BR", dict: null });

export function I18nProvider({ locale, dict, children }: I18n & { children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): TFunction {
  const { dict } = useContext(Ctx);
  return useMemo(() => makeT(dict), [dict]);
}

export function useLocale(): Locale {
  return useContext(Ctx).locale;
}
