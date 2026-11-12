"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n";
import { LOCALE_LABEL, LOCALES } from "@/lib/i18n/locales";
import { setMyLocaleAction } from "./actions";

export function LanguageForm({ current }: { current: string | null }) {
  const tr = useT();
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="field max-w-xs"
        value={value}
        disabled={pending}
        aria-label={tr("Idioma")}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          start(async () => {
            await setMyLocaleAction(v || null);
            router.refresh();
          });
        }}
      >
        <option value="">{tr("Padrão do hotel")}</option>
        {LOCALES.map((l) => (
          <option key={l} value={l}>{LOCALE_LABEL[l]}</option>
        ))}
      </select>
      {pending && <span className="text-xs text-zinc-500">…</span>}
    </div>
  );
}
