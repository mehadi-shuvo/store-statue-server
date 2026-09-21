-- Add reservation, idempotency, payment verification, and retry-safe delivery fields.
ALTER TABLE "gift_card_codes"
  ADD COLUMN "codeHash" TEXT,
  ADD COLUMN "reservationExpiresAt" TIMESTAMP(3);

ALTER TABLE "gift_card_deliveries"
  ADD COLUMN "emailAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "emailLastAttemptAt" TIMESTAMP(3);

ALTER TABLE "orders"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BDT',
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "checkoutKey" TEXT;

ALTER TABLE "payments"
  ADD COLUMN "callbackProcessedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "payments_transactionId_idx";

CREATE UNIQUE INDEX "gift_card_codes_codeHash_key" ON "gift_card_codes"("codeHash");
CREATE INDEX "gift_card_codes_reservationExpiresAt_idx" ON "gift_card_codes"("reservationExpiresAt");
CREATE UNIQUE INDEX "orders_userId_checkoutKey_key" ON "orders"("userId", "checkoutKey");
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");
CREATE UNIQUE INDEX "payments_merchantInvoiceNumber_key" ON "payments"("merchantInvoiceNumber");
