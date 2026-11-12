"use client";

import { useTransition } from "react";
import { useT } from "@/components/i18n";
import { toggleFeedbackAction } from "./actions";

export function DoneToggle({ id, done }: { id: string; done: boolean }) {
  const tr = useT();
  const [pending, start] = useTransition();
  return (
    <button className="btn-secondary px-2 py-1 text-xs" disabled={pending} onClick={() => start(() => toggleFeedbackAction(id, !done))}>
      {done ? tr("Reabrir") : tr("✓ Resolvido")}
    </button>
  );
}
