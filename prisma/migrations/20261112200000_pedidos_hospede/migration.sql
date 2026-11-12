-- CreateEnum
CREATE TYPE "GuestRequestType" AS ENUM ('LIMPEZA', 'TOALHAS', 'AMENIDADES', 'PROBLEMA', 'OUTRO');

-- CreateEnum
CREATE TYPE "GuestRequestStatus" AS ENUM ('ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "guestToken" TEXT;

-- CreateTable
CREATE TABLE "GuestRequest" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "roomId" UUID NOT NULL,
    "reservationId" UUID,
    "type" "GuestRequestType" NOT NULL,
    "message" TEXT,
    "status" "GuestRequestStatus" NOT NULL DEFAULT 'ABERTO',
    "ticketNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledById" UUID,
    "handledAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "GuestRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestRequest_number_key" ON "GuestRequest"("number");

-- CreateIndex
CREATE INDEX "GuestRequest_status_createdAt_idx" ON "GuestRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GuestRequest_roomId_createdAt_idx" ON "GuestRequest"("roomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Room_guestToken_key" ON "Room"("guestToken");

-- AddForeignKey
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

