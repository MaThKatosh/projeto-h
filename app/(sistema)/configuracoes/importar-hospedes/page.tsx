import Link from "next/link";
import { requirePermission } from "@/lib/auth/dal";
import { getT } from "@/lib/i18n/server";
import { GuestImport } from "./screen";

export const dynamic = "force-dynamic";

export default async function ImportarHospedesPage() {
  const tr = await getT();
  await requirePermission("settings.manage");
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href="/configuracoes" className="text-sm text-blue-700 underline">{tr("← Configurações")}</Link>
        <h1 className="text-2xl font-bold">{tr("📥 Importar hóspedes do sistema antigo")}</h1>
        <p className="text-sm text-zinc-500">{tr("Exporte o cadastro de clientes do sistema antigo em planilha (CSV) e envie aqui. O sistema reconhece colunas como nome, CPF/documento, nascimento, e-mail, telefone, cidade, estado e país. Nada é gravado antes da sua conferência; quem já está cadastrado não é duplicado.")}</p>
      </div>
      <GuestImport />
    </div>
  );
}
