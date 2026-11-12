-- DropIndex
DROP INDEX "AuditRun_businessDate_key";

-- AlterTable
ALTER TABLE "AuditRun" ADD COLUMN     "undoReason" TEXT,
ADD COLUMN     "undoneAt" TIMESTAMP(3),
ADD COLUMN     "undoneById" UUID;

-- AlterTable
ALTER TABLE "FolioEntry" ADD COLUMN     "auditRunId" UUID,
ADD COLUMN     "cardBrand" TEXT;

-- AlterTable
ALTER TABLE "PosPayment" ADD COLUMN     "cardBrand" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT;

-- CreateTable
CREATE TABLE "CardBrand" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CardBrand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardBrand_name_key" ON "CardBrand"("name");

-- CreateIndex
CREATE INDEX "AuditRun_businessDate_idx" ON "AuditRun"("businessDate");

-- AddForeignKey
ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "AuditRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRun" ADD CONSTRAINT "AuditRun_undoneById_fkey" FOREIGN KEY ("undoneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ================================================================
-- Uma auditoria VÁLIDA por dia (a desfeita não conta).
-- ================================================================
CREATE UNIQUE INDEX "AuditRun_one_valid_per_day" ON "AuditRun" ("businessDate") WHERE "undoneAt" IS NULL;

-- ================================================================
-- Liga as diárias já lançadas às auditorias que as lançaram (para poder
-- desfazer). Feito com a trava de imutabilidade desligada só aqui.
-- ================================================================
ALTER TABLE "FolioEntry" DISABLE TRIGGER "FolioEntry_immutable";
UPDATE "FolioEntry" f
SET "auditRunId" = a."id"
FROM "AuditRun" a
WHERE f."businessDate" = a."businessDate"
  AND f."category" IN ('DIARIA', 'ISS', 'ESTACIONAMENTO')
  AND f."nightDate" IS NOT NULL
  AND f."reversalOfId" IS NULL
  AND f."createdAt" BETWEEN a."startedAt" AND COALESCE(a."finishedAt", a."startedAt" + interval '10 minutes');
ALTER TABLE "FolioEntry" ENABLE TRIGGER "FolioEntry_immutable";

-- A trava passa a proteger também a bandeira e a auditoria de origem.
CREATE OR REPLACE FUNCTION folio_entry_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Lançamentos da conta não podem ser apagados; faça um estorno.';
  END IF;
  IF OLD."reversedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Lançamento já estornado.';
  END IF;
  IF (NEW."reservationId", NEW."kind", NEW."category", NEW."method", NEW."description", NEW."quantity",
      NEW."unitCents", NEW."amountCents", NEW."nightDate", NEW."reference", NEW."installments",
      NEW."isRefund", NEW."businessDate", NEW."createdById", NEW."createdAt", NEW."reversalOfId",
      NEW."cardBrand", NEW."auditRunId")
     IS DISTINCT FROM
     (OLD."reservationId", OLD."kind", OLD."category", OLD."method", OLD."description", OLD."quantity",
      OLD."unitCents", OLD."amountCents", OLD."nightDate", OLD."reference", OLD."installments",
      OLD."isRefund", OLD."businessDate", OLD."createdById", OLD."createdAt", OLD."reversalOfId",
      OLD."cardBrand", OLD."auditRunId") THEN
    RAISE EXCEPTION 'Lançamentos da conta não podem ser alterados; faça um estorno.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- Dados iniciais de configuração
-- ================================================================
INSERT INTO "CardBrand" ("id", "name", "sortOrder") VALUES
  (gen_random_uuid(), 'Visa', 1),
  (gen_random_uuid(), 'Mastercard', 2),
  (gen_random_uuid(), 'Elo', 3),
  (gen_random_uuid(), 'American Express', 4),
  (gen_random_uuid(), 'Hipercard', 5),
  (gen_random_uuid(), 'Diners Club', 6);

INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES
  ('hotelName', '"Sistema do Hotel"'::jsonb, now()),
  ('defaultLocale', '"pt-BR"'::jsonb, now()),
  ('checkInTime', '"14:00"'::jsonb, now()),
  ('checkOutTime', '"12:00"'::jsonb, now()),
  ('enabledMethods', '["DINHEIRO","PIX","CREDITO","DEBITO","TRANSFERENCIA"]'::jsonb, now())
ON CONFLICT ("key") DO NOTHING;
