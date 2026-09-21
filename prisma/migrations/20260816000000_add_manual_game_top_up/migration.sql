-- Make the credential policy explicit without losing existing enum-backed data.
ALTER TYPE "GameTopUpFulfillmentType"
  RENAME VALUE 'LOGIN_CREDENTIALS' TO 'ACCOUNT_ACCESS_REQUIRED';
ALTER TYPE "GameTopUpFulfillmentType"
  ADD VALUE IF NOT EXISTS 'ACCOUNT_IDENTIFIER';

-- Legacy credential-shaped fields are made unavailable until an administrator
-- replaces them with safe identifiers (UID, username, account email, region).
UPDATE "game_top_up_input_fields"
SET "isActive" = false
WHERE "name" ~* '(password|passcode|secret|otp|token)'
   OR "label" ~* '(password|passcode|facebook login|google login|gmail login)';

-- Historical package references must prevent destructive game/package cascades.
ALTER TABLE "game_top_up_packages"
  DROP CONSTRAINT IF EXISTS "game_top_up_packages_gameTopUpProductId_fkey";
ALTER TABLE "game_top_up_packages"
  ADD CONSTRAINT "game_top_up_packages_gameTopUpProductId_fkey"
  FOREIGN KEY ("gameTopUpProductId") REFERENCES "game_top_up_products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "daily_game_top_up_sequences" (
  "queueDate" DATE NOT NULL,
  "lastSerial" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "daily_game_top_up_sequences_pkey" PRIMARY KEY ("queueDate"),
  CONSTRAINT "daily_game_top_up_sequences_lastSerial_check" CHECK ("lastSerial" > 0)
);

CREATE TABLE "game_top_up_order_details" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "gameCurrencyAmountSnapshot" INTEGER NOT NULL,
  "bonusCurrencyAmountSnapshot" INTEGER NOT NULL DEFAULT 0,
  "gameCurrencyLabelSnapshot" TEXT NOT NULL,
  "queueDate" DATE,
  "dailySerial" INTEGER,
  "cancellableUntil" TIMESTAMP(3),
  "processingStartedAt" TIMESTAMP(3),
  "processedByAdminId" TEXT,
  "previousBalance" DECIMAL(20,2),
  "currentBalance" DECIMAL(20,2),
  "customerMessage" TEXT,
  "internalAdminNote" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedByAdminId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledBy" TEXT,
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "notificationSentAt" TIMESTAMP(3),
  "notificationFailure" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "game_top_up_order_details_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_top_up_order_details_queue_pair_check"
    CHECK (("queueDate" IS NULL AND "dailySerial" IS NULL) OR ("queueDate" IS NOT NULL AND "dailySerial" IS NOT NULL)),
  CONSTRAINT "game_top_up_order_details_dailySerial_check"
    CHECK ("dailySerial" IS NULL OR "dailySerial" > 0),
  CONSTRAINT "game_top_up_order_details_balances_check"
    CHECK (("previousBalance" IS NULL OR "previousBalance" >= 0) AND ("currentBalance" IS NULL OR "currentBalance" >= 0))
);

CREATE UNIQUE INDEX "game_top_up_order_details_orderItemId_key"
  ON "game_top_up_order_details"("orderItemId");
CREATE UNIQUE INDEX "game_top_up_order_details_queueDate_dailySerial_key"
  ON "game_top_up_order_details"("queueDate", "dailySerial");
CREATE INDEX "game_top_up_order_details_queueDate_dailySerial_idx"
  ON "game_top_up_order_details"("queueDate", "dailySerial");
CREATE INDEX "game_top_up_order_details_processedByAdminId_idx"
  ON "game_top_up_order_details"("processedByAdminId");
CREATE INDEX "game_top_up_order_details_completedByAdminId_idx"
  ON "game_top_up_order_details"("completedByAdminId");
CREATE INDEX "game_top_up_order_details_createdAt_idx"
  ON "game_top_up_order_details"("createdAt");

ALTER TABLE "game_top_up_order_details"
  ADD CONSTRAINT "game_top_up_order_details_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_top_up_order_details"
  ADD CONSTRAINT "game_top_up_order_details_processedByAdminId_fkey"
  FOREIGN KEY ("processedByAdminId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "game_top_up_order_details"
  ADD CONSTRAINT "game_top_up_order_details_completedByAdminId_fkey"
  FOREIGN KEY ("completedByAdminId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
