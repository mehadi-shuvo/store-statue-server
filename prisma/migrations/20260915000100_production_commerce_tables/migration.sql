ALTER TABLE "game_top_up_packages" ADD COLUMN "providerProductId" TEXT;

ALTER TABLE "game_top_up_order_details"
  ADD COLUMN "providerProductIdSnapshot" TEXT,
  ADD COLUMN "fulfillmentKey" TEXT,
  ADD COLUMN "providerAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastProviderAttemptAt" TIMESTAMP(3),
  ADD COLUMN "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN "manualReviewAt" TIMESTAMP(3),
  ADD COLUMN "notificationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "notificationLastAttemptAt" TIMESTAMP(3);

UPDATE "game_top_up_order_details"
SET "fulfillmentKey" = 'GX-TOPUP-' || "orderItemId"
WHERE "fulfillmentKey" IS NULL;

ALTER TABLE "game_top_up_order_details" ALTER COLUMN "fulfillmentKey" SET NOT NULL;

CREATE UNIQUE INDEX "game_top_up_order_details_fulfillmentKey_key" ON "game_top_up_order_details"("fulfillmentKey");
CREATE INDEX "game_top_up_order_details_nextRetryAt_idx" ON "game_top_up_order_details"("nextRetryAt");
CREATE INDEX "game_top_up_order_details_notificationLastAttemptAt_idx" ON "game_top_up_order_details"("notificationLastAttemptAt");

ALTER TABLE "payments" ADD COLUMN "reconciliationReason" TEXT;

CREATE TABLE "payment_attempts" (
  "id" TEXT NOT NULL,
  "paymentRecordId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "gateway" TEXT NOT NULL,
  "merchantTransactionId" TEXT NOT NULL,
  "gatewayTransactionId" TEXT,
  "expectedAmount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "gatewayMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

INSERT INTO "payment_attempts" (
  "id", "paymentRecordId", "orderId", "gateway", "merchantTransactionId",
  "gatewayTransactionId", "expectedAmount", "currency", "status", "initiatedAt",
  "verifiedAt", "failureReason", "gatewayMetadata", "createdAt", "updatedAt"
)
SELECT "id", "id", "orderId", "paymentProvider", COALESCE("paymentId", "id"),
  "transactionId", "amount", "currency", "paymentStatus", "createdAt",
  "callbackProcessedAt", "failureReason", "providerResponse", "createdAt", "updatedAt"
FROM "payments";

CREATE UNIQUE INDEX "payment_attempts_merchantTransactionId_key" ON "payment_attempts"("merchantTransactionId");
CREATE UNIQUE INDEX "payment_attempts_gatewayTransactionId_key" ON "payment_attempts"("gatewayTransactionId");
CREATE INDEX "payment_attempts_paymentRecordId_createdAt_idx" ON "payment_attempts"("paymentRecordId", "createdAt");
CREATE INDEX "payment_attempts_orderId_createdAt_idx" ON "payment_attempts"("orderId", "createdAt");
CREATE INDEX "payment_attempts_status_updatedAt_idx" ON "payment_attempts"("status", "updatedAt");

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_paymentRecordId_fkey"
  FOREIGN KEY ("paymentRecordId") REFERENCES "payments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
