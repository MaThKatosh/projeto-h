import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";

// Cliente do banco aceito pelos serviços: o client normal ou uma
// transação.
export type Db = PrismaClient | Prisma.TransactionClient;
