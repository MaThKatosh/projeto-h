-- CreateEnum
CREATE TYPE "Outlet" AS ENUM ('RESTAURANTE', 'FRIGOBAR');

-- CreateEnum
CREATE TYPE "ComandaStatus" AS ENUM ('ABERTA', 'FECHADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ComandaSettlement" AS ENUM ('QUARTO', 'PAGO');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDENTE', 'PRONTO', 'ENTREGUE', 'CANCELADO');

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" UUID NOT NULL,
    "outlet" "Outlet" NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "kitchen" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningTable" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 4,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comanda" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "ComandaStatus" NOT NULL DEFAULT 'ABERTA',
    "tableId" UUID,
    "reservationId" UUID,
    "customerName" TEXT,
    "people" INTEGER NOT NULL DEFAULT 1,
    "serviceFee" BOOLEAN NOT NULL DEFAULT true,
    "serviceFeeBp" INTEGER NOT NULL DEFAULT 1000,
    "settlement" "ComandaSettlement",
    "totalCents" INTEGER,
    "cancelReason" TEXT,
    "openedById" UUID,
    "closedById" UUID,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Comanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComandaItem" (
    "id" UUID NOT NULL,
    "comandaId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unitCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "kitchen" BOOLEAN NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDENTE',
    "cancelReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "ComandaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosPayment" (
    "id" UUID NOT NULL,
    "comandaId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reference" TEXT,
    "businessDate" DATE NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItem_outlet_active_idx" ON "MenuItem"("outlet", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_outlet_name_key" ON "MenuItem"("outlet", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_name_key" ON "DiningTable"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Comanda_number_key" ON "Comanda"("number");

-- CreateIndex
CREATE INDEX "Comanda_status_idx" ON "Comanda"("status");

-- CreateIndex
CREATE INDEX "Comanda_closedAt_idx" ON "Comanda"("closedAt");

-- CreateIndex
CREATE INDEX "ComandaItem_comandaId_idx" ON "ComandaItem"("comandaId");

-- CreateIndex
CREATE INDEX "ComandaItem_status_kitchen_idx" ON "ComandaItem"("status", "kitchen");

-- CreateIndex
CREATE INDEX "PosPayment_businessDate_idx" ON "PosPayment"("businessDate");

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosPayment" ADD CONSTRAINT "PosPayment_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosPayment" ADD CONSTRAINT "PosPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ================================================================
-- Regras
-- ================================================================
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_price_check" CHECK ("priceCents" >= 0);
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_seats_check" CHECK ("seats" >= 1);
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_qty_check" CHECK ("quantity" >= 1 AND "unitCents" >= 0);
ALTER TABLE "PosPayment" ADD CONSTRAINT "PosPayment_amount_check" CHECK ("amountCents" > 0);
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_people_check" CHECK ("people" >= 1 AND "serviceFeeBp" >= 0);
-- Comanda fechada sempre diz como foi acertada e o total.
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_closed_check"
  CHECK ("status" <> 'FECHADA' OR ("settlement" IS NOT NULL AND "totalCents" IS NOT NULL));

-- ================================================================
-- Dados de exemplo (o gerente ajusta em Cardápio)
-- ================================================================
INSERT INTO "DiningTable" ("id", "name", "seats")
SELECT gen_random_uuid(), n::text, CASE WHEN n <= 6 THEN 4 ELSE 6 END FROM generate_series(1, 8) AS n;

INSERT INTO "MenuItem" ("id", "outlet", "name", "group", "priceCents", "kitchen", "sortOrder") VALUES
  (gen_random_uuid(), 'RESTAURANTE', 'Água mineral 500ml',        'Bebidas',    600, false, 1),
  (gen_random_uuid(), 'RESTAURANTE', 'Refrigerante lata',         'Bebidas',    800, false, 2),
  (gen_random_uuid(), 'RESTAURANTE', 'Suco natural',              'Bebidas',   1200, true,  3),
  (gen_random_uuid(), 'RESTAURANTE', 'Cerveja long neck',         'Bebidas',   1400, false, 4),
  (gen_random_uuid(), 'RESTAURANTE', 'Caipirinha',                'Bebidas',   2200, true,  5),
  (gen_random_uuid(), 'RESTAURANTE', 'Porção de batata frita',    'Petiscos',  3200, true,  1),
  (gen_random_uuid(), 'RESTAURANTE', 'Isca de peixe',             'Petiscos',  4800, true,  2),
  (gen_random_uuid(), 'RESTAURANTE', 'Filé à parmegiana',         'Pratos',    6900, true,  1),
  (gen_random_uuid(), 'RESTAURANTE', 'Frango grelhado com legumes','Pratos',   4900, true,  2),
  (gen_random_uuid(), 'RESTAURANTE', 'Risoto de cogumelos',       'Pratos',    5800, true,  3),
  (gen_random_uuid(), 'RESTAURANTE', 'Club sandwich',             'Lanches',   3600, true,  1),
  (gen_random_uuid(), 'RESTAURANTE', 'Pudim',                     'Sobremesas',1600, true,  1),
  (gen_random_uuid(), 'RESTAURANTE', 'Petit gâteau',              'Sobremesas',2400, true,  2),
  (gen_random_uuid(), 'FRIGOBAR',    'Água mineral',              'Bebidas',    700, false, 1),
  (gen_random_uuid(), 'FRIGOBAR',    'Água com gás',              'Bebidas',    800, false, 2),
  (gen_random_uuid(), 'FRIGOBAR',    'Refrigerante lata',         'Bebidas',    900, false, 3),
  (gen_random_uuid(), 'FRIGOBAR',    'Cerveja lata',              'Bebidas',   1200, false, 4),
  (gen_random_uuid(), 'FRIGOBAR',    'Suco de caixinha',          'Bebidas',    800, false, 5),
  (gen_random_uuid(), 'FRIGOBAR',    'Chocolate',                 'Snacks',     900, false, 1),
  (gen_random_uuid(), 'FRIGOBAR',    'Amendoim',                  'Snacks',     800, false, 2),
  (gen_random_uuid(), 'FRIGOBAR',    'Batata chips',              'Snacks',    1000, false, 3);

INSERT INTO "Setting" ("key", "value", "updatedAt")
VALUES ('restaurantServiceBp', '1000'::jsonb, now())
ON CONFLICT ("key") DO NOTHING;
