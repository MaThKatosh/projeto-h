import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

// ================================================================
// CLIENTE DO BANCO (somente servidor)
// ================================================================
//
// Uma única instância por processo. Em desenvolvimento o Next recarrega
// módulos a cada edição; guardar no globalThis evita abrir um pool novo
// a cada recarga.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não definida. Copie .env.example para .env.");
  }
  return url;
}

export function getDb(): PrismaClient {
  globalForPrisma.prisma ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl() }),
  });
  return globalForPrisma.prisma;
}
