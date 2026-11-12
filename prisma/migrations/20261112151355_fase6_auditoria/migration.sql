-- CreateTable
CREATE TABLE "AuditRun" (
    "id" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "nextDate" DATE NOT NULL,
    "userId" UUID,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "nightsPosted" INTEGER NOT NULL DEFAULT 0,
    "nightsCents" INTEGER NOT NULL DEFAULT 0,
    "roomsOccupied" INTEGER NOT NULL DEFAULT 0,
    "roomsAvailable" INTEGER NOT NULL DEFAULT 0,
    "guests" INTEGER NOT NULL DEFAULT 0,
    "lodgingCents" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "receivedCents" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,

    CONSTRAINT "AuditRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditRun_businessDate_key" ON "AuditRun"("businessDate");

-- AddForeignKey
ALTER TABLE "AuditRun" ADD CONSTRAINT "AuditRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
