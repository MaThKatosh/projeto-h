"use client";


import { useT } from "@/components/i18n";export function PrintButton() {
  const tr = useT();
  return (
    <button type="button" className="btn-secondary" onClick={() => window.print()}>{tr("🖨 Imprimir")}</button>
  );
}
