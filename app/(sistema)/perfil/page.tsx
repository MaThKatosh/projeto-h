import { verifySession } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/permissions";
import { PasswordForm } from "./password-form";

export default async function PerfilPage() {
  const { user } = await verifySession();

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Meu perfil</h1>
      <section className="card space-y-1 p-5 text-sm">
        <div><span className="text-zinc-500">Nome:</span> <b>{user.fullName}</b></div>
        <div><span className="text-zinc-500">Usuário:</span> @{user.username}</div>
        <div><span className="text-zinc-500">Cargo:</span> {ROLE_LABEL[user.role]}</div>
        <p className="pt-2 text-xs text-zinc-500">Para mudar nome ou cargo, fale com o gerente.</p>
      </section>
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Trocar minha senha</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
