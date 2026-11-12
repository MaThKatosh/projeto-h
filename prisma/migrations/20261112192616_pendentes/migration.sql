-- CreateEnum
CREATE TYPE "PendingStatus" AS ENUM ('ABERTA', 'QUITADA', 'BAIXADA');

-- AlterEnum
ALTER TYPE "FolioKind" ADD VALUE 'PENDENTE';

-- CreateTable
CREATE TABLE "PendingAccount" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "reservationId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PendingStatus" NOT NULL DEFAULT 'ABERTA',
    "businessDate" DATE NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedById" UUID,
    "closeReason" TEXT,

    CONSTRAINT "PendingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingPayment" (
    "id" UUID NOT NULL,
    "pendingAccountId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "cardBrand" TEXT,
    "amountCents" INTEGER NOT NULL,
    "reference" TEXT,
    "businessDate" DATE NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingAccount_number_key" ON "PendingAccount"("number");

-- CreateIndex
CREATE INDEX "PendingAccount_status_idx" ON "PendingAccount"("status");

-- CreateIndex
CREATE INDEX "PendingAccount_guestId_idx" ON "PendingAccount"("guestId");

-- CreateIndex
CREATE INDEX "PendingPayment_businessDate_idx" ON "PendingPayment"("businessDate");

-- AddForeignKey
ALTER TABLE "PendingAccount" ADD CONSTRAINT "PendingAccount_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAccount" ADD CONSTRAINT "PendingAccount_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAccount" ADD CONSTRAINT "PendingAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAccount" ADD CONSTRAINT "PendingAccount_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingPayment" ADD CONSTRAINT "PendingPayment_pendingAccountId_fkey" FOREIGN KEY ("pendingAccountId") REFERENCES "PendingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingPayment" ADD CONSTRAINT "PendingPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
