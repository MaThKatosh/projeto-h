-- This is an empty migration.-- Uma reserva de portal (origem + código) entra uma vez só: importar o
-- mesmo arquivo duas vezes, ou o channel manager reenviar, não duplica.
CREATE UNIQUE INDEX "Reservation_source_externalCode_key"
  ON "Reservation" ("source", "externalCode")
  WHERE "externalCode" IS NOT NULL;
