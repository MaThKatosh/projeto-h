-- CreateTable
CREATE TABLE "Feedback" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "userId" UUID,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "device" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_number_key" ON "Feedback"("number");

-- CreateIndex
CREATE INDEX "Feedback_done_createdAt_idx" ON "Feedback"("done", "createdAt");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

