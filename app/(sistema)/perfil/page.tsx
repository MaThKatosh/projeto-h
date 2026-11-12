import { verifySession } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/permissions";
import { PasswordForm } from "./password-form";
import { LanguageForm } from "./language";
import { getDb } from "@/lib/db";

import { getT } from "@/lib/i18n/server";
export default async function PerfilPage() {
  const tr = await getT();
  const { user } = await verifySession();
  const me = await getDb().user.findUnique({ where: { id: user.id }, select: { locale: true } });

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">{tr("Meu perfil")}</h1>
      <section className="card space-y-1 p-5 text-sm">
        <div><span className="text-zinc-500">{tr("Nome:")}</span> <b>{user.fullName}</b></div>
        <div><span className="text-zinc-500">{tr("Usuário:")}</span> @{user.username}</div>
        <div><span className="text-zinc-500">{tr("Cargo:")}</span> {tr(ROLE_LABEL[user.role])}</div>
        <p className="pt-2 text-xs text-zinc-500">{tr("Para mudar nome ou cargo, fale com o gerente.")}</p>
      </section>
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">{tr("Idioma")}</h2>
        <LanguageForm current={me?.locale ?? null} />
      </section>
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">{tr("Trocar minha senha")}</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
