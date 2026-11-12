-- Lançamento PENDENTE (parte da conta enviada para conta pendente):
-- sem categoria e sem forma de pagamento.
ALTER TABLE "FolioEntry" DROP CONSTRAINT "FolioEntry_kind_check";
ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_kind_check" CHECK (
  (kind = 'COBRANCA' AND category IS NOT NULL AND method IS NULL)
  OR (kind = 'PAGAMENTO' AND method IS NOT NULL AND category IS NULL)
  OR (kind = 'PENDENTE' AND method IS NULL AND category IS NULL)
);

-- Recebimentos de conta pendente: valor sempre positivo.
ALTER TABLE "PendingPayment" ADD CONSTRAINT "PendingPayment_amount_check" CHECK ("amountCents" > 0);
ALTER TABLE "PendingAccount" ADD CONSTRAINT "PendingAccount_amount_check" CHECK ("amountCents" > 0);
