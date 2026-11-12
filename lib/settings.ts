import type { Db } from "@/lib/db-types";

// Configurações simples do hotel (tabela Setting, chave/valor).

export async function getParkingDailyCents(db: Db): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: "parkingDailyCents" } });
  const n = Number(row?.value ?? 0);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export async function setParkingDailyCents(db: Db, cents: number) {
  await db.setting.upsert({
    where: { key: "parkingDailyCents" },
    create: { key: "parkingDailyCents", value: cents },
    update: { value: cents },
  });
}
