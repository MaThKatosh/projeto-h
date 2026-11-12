-- CreateEnum
CREATE TYPE "RevenueRuleKind" AS ENUM ('OCUPACAO', 'DIA_SEMANA', 'PERIODO', 'ANTECEDENCIA');

-- CreateTable
CREATE TABLE "RevenueRule" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RevenueRuleKind" NOT NULL,
    "params" JSONB NOT NULL,
    "adjustBp" INTEGER NOT NULL,
    "roomTypeId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RevenueRule" ADD CONSTRAINT "RevenueRule_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

