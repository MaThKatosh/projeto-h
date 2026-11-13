"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n";
import { rotateQrAction } from "./actions";

export function RotateButton({ roomId }: { roomId: string }) {
  const tr = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="no-print mt-1 text-[11px] text-zinc-500 underline"
      disabled={pending}
      onClick={() => {
        if (!confirm(tr("Trocar o código deste quarto? O QR antigo para de funcionar e é preciso imprimir de novo."))) return;
        start(async () => {
          await rotateQrAction(roomId);
          router.refresh();
        });
      }}
    >
      {tr("trocar código")}
    </button>
  );
}

// Copia o link do QR (para a equipe testar sem celular ou mandar ao hóspede).
export function CopyLinkButton({ url }: { url: string }) {
  const tr = useT();
  return (
    <button
      type="button"
      className="no-print mt-1 mr-2 text-[11px] text-blue-700 underline"
      onClick={() => navigator.clipboard?.writeText(url).then(() => alert(tr("Link copiado.")), () => prompt(tr("Copie o link:"), url))}
    >
      {tr("copiar link")}
    </button>
  );
}
