import Link from "next/link";
import { requirePermission } from "@/lib/auth/dal";
import { getT } from "@/lib/i18n/server";
import { PrivacyTools } from "./tools";

export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  const tr = await getT();
  await requirePermission("settings.manage");
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/configuracoes" className="text-sm text-blue-700 underline">{tr("← Configurações")}</Link>
        <h1 className="text-2xl font-bold">{tr("🔒 Privacidade dos hóspedes (LGPD)")}</h1>
        <p className="text-sm text-zinc-500">
          {tr("Atenda pedidos dos hóspedes sobre os dados deles e apague o que não precisa mais ser guardado. Tudo fica registrado no relatório “Registro de ações”.")}{" "}
          <Link href="/privacidade" target="_blank" className="text-blue-700 underline">{tr("Ver a política de privacidade pública")}</Link>
        </p>
      </div>
      <PrivacyTools />
    </div>
  );
}
