import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { canManageRole, manageableRoles, ROLE_LABEL, ROLE_LEVEL, type Role } from "@/lib/permissions";
import { NewUserForm, UserRow } from "./forms";

import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const tr = await getT();
  const { user: me } = await requirePermission("users.manage");
  const users = await getDb().user.findMany({
    select: { id: true, username: true, fullName: true, role: true, active: true, lastLoginAt: true },
  });
  users.sort((a, b) => ROLE_LEVEL[b.role] - ROLE_LEVEL[a.role] || a.fullName.localeCompare(b.fullName, "pt-BR"));
  const roles = manageableRoles(me.role).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tr("Usuários")}</h1>
        <p className="text-sm text-zinc-500">{tr("Cada funcionário tem seu usuário. O cargo define o que ele pode fazer. Você pode criar e editar cargos abaixo do seu{0}.", [me.role === "ADMIN" ? tr(" (como administrador, todos)") : ""])}</p>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">{tr("Novo usuário")}</h2>
        <NewUserForm roles={roles} />
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">{tr("Equipe ({0})", [users.length])}</h2>
        <div className="space-y-2">
          {users.map((u) => {
            const self = u.id === me.id;
            const editable = self || canManageRole(me.role, u.role as Role);
            return (
              <UserRow
                key={u.id}
                user={{ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }}
                roleLabel={ROLE_LABEL[u.role]}
                roles={self ? [{ value: u.role, label: ROLE_LABEL[u.role] }] : roles}
                editable={editable}
                self={self}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
