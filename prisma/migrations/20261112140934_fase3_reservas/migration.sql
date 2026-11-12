-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMADA', 'HOSPEDADA', 'FINALIZADA', 'CANCELADA', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('BALCAO', 'TELEFONE', 'EMAIL', 'WHATSAPP', 'SITE', 'BOOKING', 'HOTEIS_COM', 'EXPEDIA', 'DECOLAR', 'AIRBNB', 'AGENCIA', 'OUTRO');

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "docType" TEXT,
    "docNumber" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "birthDate" DATE,
    "nationality" TEXT,
    "city" TEXT,
    "state" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePlan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "includesBreakfast" BOOLEAN NOT NULL DEFAULT true,
    "chargeIss" BOOLEAN NOT NULL DEFAULT false,
    "issBasisPoints" INTEGER NOT NULL DEFAULT 500,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePrice" (
    "ratePlanId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "dailyCents" INTEGER NOT NULL,

    CONSTRAINT "RatePrice_pkey" PRIMARY KEY ("ratePlanId","roomTypeId")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMADA',
    "guestId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "roomId" UUID,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "ratePlanId" UUID,
    "dailyCents" INTEGER NOT NULL,
    "breakfast" BOOLEAN NOT NULL DEFAULT true,
    "chargeIss" BOOLEAN NOT NULL DEFAULT false,
    "issBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "source" "ReservationSource" NOT NULL DEFAULT 'BALCAO',
    "externalCode" TEXT,
    "notes" TEXT,
    "cancelReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationGuest" (
    "reservationId" UUID NOT NULL,
    "guestId" UUID NOT NULL,

    CONSTRAINT "ReservationGuest_pkey" PRIMARY KEY ("reservationId","guestId")
);

-- CreateTable
CREATE TABLE "ReservationEvent" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "userId" UUID,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMove" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "fromRoomId" UUID NOT NULL,
    "toRoomId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "plate" TEXT NOT NULL,
    "model" TEXT,
    "color" TEXT,
    "spot" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Guest_fullName_idx" ON "Guest"("fullName");

-- CreateIndex
CREATE INDEX "Guest_docNumber_idx" ON "Guest"("docNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RatePlan_name_key" ON "RatePlan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_number_key" ON "Reservation"("number");

-- CreateIndex
CREATE INDEX "Reservation_status_checkIn_idx" ON "Reservation"("status", "checkIn");

-- CreateIndex
CREATE INDEX "Reservation_status_checkOut_idx" ON "Reservation"("status", "checkOut");

-- CreateIndex
CREATE INDEX "Reservation_roomId_idx" ON "Reservation"("roomId");

-- CreateIndex
CREATE INDEX "Reservation_guestId_idx" ON "Reservation"("guestId");

-- CreateIndex
CREATE INDEX "ReservationEvent_reservationId_createdAt_idx" ON "ReservationEvent"("reservationId", "createdAt");

-- CreateIndex
CREATE INDEX "RoomMove_createdAt_idx" ON "RoomMove"("createdAt");

-- CreateIndex
CREATE INDEX "Vehicle_exitedAt_idx" ON "Vehicle"("exitedAt");

-- CreateIndex
CREATE INDEX "Vehicle_plate_idx" ON "Vehicle"("plate");

-- AddForeignKey
ALTER TABLE "RatePrice" ADD CONSTRAINT "RatePrice_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePrice" ADD CONSTRAINT "RatePrice_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationEvent" ADD CONSTRAINT "ReservationEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationEvent" ADD CONSTRAINT "ReservationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMove" ADD CONSTRAINT "RoomMove_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMove" ADD CONSTRAINT "RoomMove_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMove" ADD CONSTRAINT "RoomMove_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMove" ADD CONSTRAINT "RoomMove_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ================================================================
-- Regras que o Prisma não expressa
-- ================================================================

-- Datas e valores coerentes.
ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_dates_check" CHECK ("checkOut" > "checkIn"),
  ADD CONSTRAINT "Reservation_people_check" CHECK ("adults" >= 1 AND "children" >= 0),
  ADD CONSTRAINT "Reservation_money_check" CHECK ("dailyCents" >= 0 AND "issBasisPoints" >= 0),
  ADD CONSTRAINT "Reservation_inhouse_room_check" CHECK ("status" <> 'HOSPEDADA' OR "roomId" IS NOT NULL);

ALTER TABLE "RatePrice" ADD CONSTRAINT "RatePrice_money_check" CHECK ("dailyCents" >= 0);

-- Um quarto nunca tem duas reservas ativas nas mesmas noites.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_no_room_overlap"
  EXCLUDE USING gist ("roomId" WITH =, daterange("checkIn", "checkOut") WITH &&)
  WHERE ("roomId" IS NOT NULL AND "status" IN ('CONFIRMADA', 'HOSPEDADA'));

-- ================================================================
-- Dados iniciais
-- ================================================================

-- Data do sistema começa no dia de hoje.
INSERT INTO "Setting" ("key", "value", "updatedAt")
VALUES ('businessDate', to_jsonb(to_char(current_date, 'YYYY-MM-DD')), now())
ON CONFLICT ("key") DO NOTHING;

-- Tarifa "Balcão" com um preço por tipo de quarto (o gerente ajusta depois).
INSERT INTO "RatePlan" ("id", "name", "includesBreakfast", "chargeIss", "issBasisPoints")
VALUES (gen_random_uuid(), 'Balcão', true, true, 500)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "RatePrice" ("ratePlanId", "roomTypeId", "dailyCents")
SELECT p."id", t."id", 15000 + 6000 * (t."capacity" - 1)
FROM "RatePlan" p CROSS JOIN "RoomType" t
WHERE p."name" = 'Balcão'
ON CONFLICT DO NOTHING;

-- Quartos marcados "ocupado" na Fase 1 viram hospedagens de verdade, com
-- um hóspede de exemplo (a ocupação agora só muda por check-in/check-out).
WITH occupied AS (
  SELECT r."id" AS room_id, r."number", r."roomTypeId", gen_random_uuid() AS guest_id
  FROM "Room" r WHERE r."occupancy" = 'OCUPADO'
), guests AS (
  INSERT INTO "Guest" ("id", "fullName", "updatedAt")
  SELECT guest_id, 'Hóspede de exemplo ' || "number", now() FROM occupied
  RETURNING "id"
)
INSERT INTO "Reservation" ("id", "status", "guestId", "roomTypeId", "roomId", "checkIn", "checkOut",
                           "adults", "ratePlanId", "dailyCents", "breakfast", "chargeIss", "issBasisPoints",
                           "notes", "updatedAt", "checkedInAt")
SELECT gen_random_uuid(), 'HOSPEDADA', o.guest_id, o."roomTypeId", o.room_id,
       current_date - 1, current_date + 2, 1, p."id", COALESCE(rp."dailyCents", 20000), true, true, 500,
       'Criada automaticamente a partir do exemplo da Fase 1', now(), now()
FROM occupied o
JOIN guests g ON g."id" = o.guest_id
LEFT JOIN "RatePlan" p ON p."name" = 'Balcão'
LEFT JOIN "RatePrice" rp ON rp."ratePlanId" = p."id" AND rp."roomTypeId" = o."roomTypeId";

INSERT INTO "ReservationEvent" ("id", "reservationId", "type", "message")
SELECT gen_random_uuid(), "id", 'checkin', 'Convertida do exemplo da Fase 1' FROM "Reservation";
