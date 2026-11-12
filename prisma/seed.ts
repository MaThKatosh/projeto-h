import "dotenv/config";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

// ================================================================
// DADOS INICIAIS
// ================================================================
//
// Cria o primeiro administrador (SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD
// do .env) e, se o hotel ainda não tem quartos, um hotel de exemplo com
// 3 andares para testar o mapa. Pode rodar mais de uma vez sem duplicar.

async function main() {
  const db = getDb();

  const username = (process.env.SEED_ADMIN_USERNAME || "admin").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("Defina SEED_ADMIN_PASSWORD (mín. 8 caracteres) no .env.");
  }

  const admin = await db.user.findUnique({ where: { username } });
  if (admin) {
    console.log(`Administrador "${username}" já existe (senha não alterada).`);
  } else {
    await db.user.create({
      data: { username, fullName: "Administrador", role: "ADMIN", passwordHash: await hashPassword(password) },
    });
    console.log(`Administrador "${username}" criado. A senha está no .env (SEED_ADMIN_PASSWORD).`);
  }

  if ((await db.room.count()) > 0) {
    console.log("O hotel já tem quartos: exemplo não criado.");
    return;
  }

  const types = await Promise.all(
    [
      { name: "Standard Solteiro", capacity: 1 },
      { name: "Standard Casal", capacity: 2 },
      { name: "Luxo", capacity: 3 },
      { name: "Suíte", capacity: 4 },
    ].map((t) => db.roomType.create({ data: t }))
  );

  // Situações variadas para o mapa ficar colorido no exemplo.
  const samples = [
    {},
    { occupancy: "OCUPADO" },
    { housekeeping: "SUJO" },
    { occupancy: "OCUPADO", housekeeping: "SUJO" },
    { housekeeping: "EM_ARRUMACAO" },
    {},
    { maintenance: "COM_PROBLEMA", note: "Chuveiro pingando" },
    { occupancy: "OCUPADO" },
    { maintenance: "EM_MANUTENCAO", note: "Troca do ar-condicionado" },
    {},
    { maintenance: "BLOQUEADO", note: "Reforma do banheiro" },
    { occupancy: "OCUPADO", maintenance: "COM_PROBLEMA", note: "TV sem sinal" },
  ] as const;

  let i = 0;
  for (const floor of [1, 2, 3]) {
    for (let n = 1; n <= 10; n++) {
      const type = floor === 3 ? (n <= 6 ? types[2] : types[3]) : n <= 3 ? types[0] : types[1];
      await db.room.create({
        data: { number: `${floor}${String(n).padStart(2, "0")}`, floor, roomTypeId: type.id, ...samples[i++ % samples.length] },
      });
    }
  }
  console.log("Hotel de exemplo criado: 30 quartos em 3 andares.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
