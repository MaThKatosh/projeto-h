"use client";

import { useState, useTransition } from "react";
import { vehicleExitAction } from "../reservas/actions";

import { useT } from "@/components/i18n";
export function ExitButton({ vehicleId }: { vehicleId: string }) {
  const tr = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn-secondary px-2 py-1 text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await vehicleExitAction(vehicleId);
            if (!r.ok) setError(r.error ?? "Não foi possível.");
          })
        }
      >{tr("Registrar saída")}</button>
      {error && <span className="block text-xs text-red-600">{tr(error)}</span>}
    </>
  );
}
