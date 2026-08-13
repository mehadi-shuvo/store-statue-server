ALTER TABLE "payments"
ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT NOT NULL DEFAULT 'mock',
ADD COLUMN IF NOT EXISTS "paymentId" TEXT,
ADD COLUMN IF NOT EXISTS "providerResponse" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_paymentId_key" ON "payments"("paymentId");
CREATE INDEX IF NOT EXISTS "payments_paymentProvider_idx" ON "payments"("paymentProvider");
CREATE INDEX IF NOT EXISTS "payments_paymentId_idx" ON "payments"("paymentId");
