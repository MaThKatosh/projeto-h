"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n";
import { LOCALES } from "@/lib/i18n/locales";
import { setLoginLocaleAction } from "./actions";

const SHORT: Record<string, string> = { "pt-BR": "PT", en: "EN", es: "ES" };

// PT · EN · ES na tela de login (antes de saber quem é o funcionário).
export function LanguageSwitch() {
  const current = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="mt-6 flex justify-center gap-1 text-xs">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={current === l}
          onClick={() =>
            start(async () => {
              await setLoginLocaleAction(l);
              router.refresh();
            })
          }
          className={`rounded-md px-2 py-1 font-semibold ${current === l ? "bg-blue-600 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
