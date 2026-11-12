-- CreateEnum
CREATE TYPE "FolioKind" AS ENUM ('COBRANCA', 'PAGAMENTO');

-- CreateEnum
CREATE TYPE "ChargeCategory" AS ENUM ('DIARIA', 'ISS', 'ESTACIONAMENTO', 'FRIGOBAR', 'RESTAURANTE', 'LAVANDERIA', 'TELEFONE', 'DANOS', 'OUTRO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('DINHEIRO', 'PIX', 'CREDITO', 'DEBITO', 'TRANSFERENCIA');

-- CreateTable
CREATE TABLE "FolioEntry" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "kind" "FolioKind" NOT NULL,
    "category" "ChargeCategory",
    "method" "PaymentMethod",
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCents" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "nightDate" DATE,
    "reference" TEXT,
    "installments" INTEGER,
    "isRefund" BOOLEAN NOT NULL DEFAULT false,
    "businessDate" DATE NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversalOfId" UUID,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reverseReason" TEXT,

    CONSTRAINT "FolioEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FolioEntry_reversalOfId_key" ON "FolioEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "FolioEntry_reservationId_createdAt_idx" ON "FolioEntry"("reservationId", "createdAt");

-- CreateIndex
CREATE INDEX "FolioEntry_businessDate_kind_idx" ON "FolioEntry"("businessDate", "kind");

-- AddForeignKey
ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "FolioEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ================================================================
-- Regras da conta que o Prisma não expressa
-- ================================================================

ALTER TABLE "FolioEntry"
  ADD CONSTRAINT "FolioEntry_kind_check" CHECK (
    ("kind" = 'COBRANCA' AND "category" IS NOT NULL AND "method" IS NULL) OR
    ("kind" = 'PAGAMENTO' AND "method" IS NOT NULL AND "category" IS NULL)
  ),
  ADD CONSTRAINT "FolioEntry_amount_check" CHECK ("amountCents" <> 0),
  -- Valor negativo só em estorno ou devolução.
  ADD CONSTRAINT "FolioEntry_negative_check" CHECK ("amountCents" > 0 OR "reversalOfId" IS NOT NULL OR "isRefund"),
  ADD CONSTRAINT "FolioEntry_quantity_check" CHECK ("quantity" >= 1);

-- A mesma noite não é cobrada duas vezes (diária, ISS, estacionamento),
-- a não ser que a cobrança anterior tenha sido estornada.
CREATE UNIQUE INDEX "FolioEntry_one_per_night"
  ON "FolioEntry" ("reservationId", "category", "nightDate")
  WHERE "nightDate" IS NOT NULL AND "reversalOfId" IS NULL AND "reversedAt" IS NULL;

-- Lançamento é imutável: não se apaga e só se pode marcar o estorno, uma vez.
CREATE FUNCTION folio_entry_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Lançamentos da conta não podem ser apagados; faça um estorno.';
  END IF;
  IF OLD."reversedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Lançamento já estornado.';
  END IF;
  IF (NEW."reservationId", NEW."kind", NEW."category", NEW."method", NEW."description", NEW."quantity",
      NEW."unitCents", NEW."amountCents", NEW."nightDate", NEW."reference", NEW."installments",
      NEW."isRefund", NEW."businessDate", NEW."createdById", NEW."createdAt", NEW."reversalOfId")
     IS DISTINCT FROM
     (OLD."reservationId", OLD."kind", OLD."category", OLD."method", OLD."description", OLD."quantity",
      OLD."unitCents", OLD."amountCents", OLD."nightDate", OLD."reference", OLD."installments",
      OLD."isRefund", OLD."businessDate", OLD."createdById", OLD."createdAt", OLD."reversalOfId") THEN
    RAISE EXCEPTION 'Lançamentos da conta não podem ser alterados; faça um estorno.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FolioEntry_immutable"
  BEFORE UPDATE OR DELETE ON "FolioEntry"
  FOR EACH ROW EXECUTE FUNCTION folio_entry_immutable();

-- Valor do estacionamento por noite (0 = grátis). O gerente muda em Tarifas.
INSERT INTO "Setting" ("key", "value", "updatedAt")
VALUES ('parkingDailyCents', '0'::jsonb, now())
ON CONFLICT ("key") DO NOTHING;
