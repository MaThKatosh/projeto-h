import type { Db } from "@/lib/db-types";
import type { SessionUser } from "@/lib/auth/service";

// Usuários técnicos: aparecem como autores do que chega de fora (channel
// manager, QR do quarto). Ficam inativos e o "#" não é aceito em nomes de
// usuário — ninguém entra no sistema com eles nem consegue criar um igual.
export const INTEGRATION_USERNAME = "#integracao";
export const GUEST_QR_USERNAME = "#hospede";

const NAMES: Record<string, string> = {
  [INTEGRATION_USERNAME]: "Integração (channel manager)",
  [GUEST_QR_USERNAME]: "Hóspede (QR do quarto)",
};

export const SYSTEM_USERNAMES = Object.keys(NAMES);

export async function systemActor(db: Db, username: keyof typeof NAMES): Promise<SessionUser> {
  return db.user.upsert({
    where: { username },
    update: {},
    create: { username, fullName: NAMES[username], role: "RECEPCAO", active: false, passwordHash: "!" },
    select: { id: true, username: true, fullName: true, role: true },
  });
}
