-- Fase 2: regras que o Prisma não expressa + conversão dos dados da Fase 1.

-- No máximo UMA tarefa de limpeza aberta por quarto.
CREATE UNIQUE INDEX "CleaningTask_one_open_per_room"
  ON "CleaningTask" ("roomId")
  WHERE "status" IN ('PENDENTE', 'EM_ANDAMENTO');

-- Quartos sujos/em arrumação viram tarefas de limpeza.
INSERT INTO "CleaningTask" ("id", "roomId", "status", "startedAt")
SELECT gen_random_uuid(), r."id",
       CASE WHEN r."housekeeping" = 'EM_ARRUMACAO' THEN 'EM_ANDAMENTO'::"CleaningStatus" ELSE 'PENDENTE'::"CleaningStatus" END,
       CASE WHEN r."housekeeping" = 'EM_ARRUMACAO' THEN now() ELSE NULL END
FROM "Room" r
WHERE r."housekeeping" IN ('SUJO', 'EM_ARRUMACAO');

-- Quartos com problema/em manutenção viram ocorrências (título = observação).
INSERT INTO "MaintenanceTicket" ("id", "roomId", "title", "status", "outOfOrder", "updatedAt", "startedAt")
SELECT gen_random_uuid(), r."id",
       COALESCE(NULLIF(r."note", ''), 'Problema registrado antes da Fase 2'),
       CASE WHEN r."maintenance" = 'EM_MANUTENCAO' THEN 'EM_ANDAMENTO'::"TicketStatus" ELSE 'ABERTA'::"TicketStatus" END,
       r."maintenance" = 'EM_MANUTENCAO',
       now(),
       CASE WHEN r."maintenance" = 'EM_MANUTENCAO' THEN now() ELSE NULL END
FROM "Room" r
WHERE r."maintenance" IN ('COM_PROBLEMA', 'EM_MANUTENCAO');

INSERT INTO "TicketEvent" ("id", "ticketId", "type", "message")
SELECT gen_random_uuid(), t."id", 'criada', 'Convertida automaticamente da Fase 1'
FROM "MaintenanceTicket" t;
