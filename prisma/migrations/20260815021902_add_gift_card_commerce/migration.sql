-- Gift-card inventory is stateful and each sold unit is linked to an order item.
CREATE TYPE "GiftCardCodeStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'DISABLED', 'EXPIRED');

ALTER TABLE "gift_card_products"
  ADD COLUMN "shortDescription" TEXT,
  ADD COLUMN "logoUrl" TEXT;

ALTER TABLE "gift_card_codes"
  ADD COLUMN "status" "GiftCardCodeStatus",
  ADD COLUMN "reservedAt" TIMESTAMP(3),
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT;

UPDATE "gift_card_codes"
SET "status" = CASE WHEN "isSold" THEN 'SOLD'::"GiftCardCodeStatus" ELSE 'AVAILABLE'::"GiftCardCodeStatus" END;

ALTER TABLE "gift_card_codes"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'AVAILABLE',
  DROP COLUMN "isSold";

ALTER TABLE "orders" ADD COLUMN "deliveryEmail" TEXT;

ALTER TABLE "order_items"
  ADD COLUMN "brandSnapshot" TEXT,
  ADD COLUMN "faceValueSnapshot" DECIMAL(12,2),
  ADD COLUMN "faceCurrencySnapshot" TEXT;

CREATE TABLE "gift_card_deliveries" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "inventoryCodeId" TEXT NOT NULL,
  "cardNameSnapshot" TEXT NOT NULL,
  "brandSnapshot" TEXT NOT NULL,
  "faceValueSnapshot" DECIMAL(12,2) NOT NULL,
  "currencySnapshot" TEXT NOT NULL,
  "expiryDateSnapshot" TIMESTAMP(3),
  "deliveryEmail" TEXT NOT NULL,
  "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "deliveredAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gift_card_deliveries_pkey" PRIMARY KEY ("id")
);

DROP INDEX IF EXISTS "gift_card_codes_orderItemId_key";
DROP INDEX IF EXISTS "gift_card_codes_denominationId_idx";
DROP INDEX IF EXISTS "gift_card_codes_isSold_idx";

CREATE UNIQUE INDEX "gift_card_codes_code_key" ON "gift_card_codes"("code");
CREATE INDEX "gift_card_codes_denominationId_status_idx" ON "gift_card_codes"("denominationId", "status");
CREATE INDEX "gift_card_codes_status_idx" ON "gift_card_codes"("status");
CREATE INDEX "gift_card_codes_expiryDate_idx" ON "gift_card_codes"("expiryDate");
CREATE INDEX "gift_card_codes_orderItemId_idx" ON "gift_card_codes"("orderItemId");
CREATE UNIQUE INDEX "gift_card_deliveries_inventoryCodeId_key" ON "gift_card_deliveries"("inventoryCodeId");
CREATE INDEX "gift_card_deliveries_orderItemId_idx" ON "gift_card_deliveries"("orderItemId");
CREATE INDEX "gift_card_deliveries_deliveryEmail_idx" ON "gift_card_deliveries"("deliveryEmail");
CREATE INDEX "gift_card_deliveries_deliveryStatus_idx" ON "gift_card_deliveries"("deliveryStatus");
CREATE INDEX "orders_deliveryEmail_idx" ON "orders"("deliveryEmail");

ALTER TABLE "gift_card_denominations" DROP CONSTRAINT IF EXISTS "gift_card_denominations_giftCardProductId_fkey";
ALTER TABLE "gift_card_codes" DROP CONSTRAINT IF EXISTS "gift_card_codes_denominationId_fkey";
ALTER TABLE "gift_card_codes" DROP CONSTRAINT IF EXISTS "gift_card_codes_orderItemId_fkey";

ALTER TABLE "gift_card_denominations" ADD CONSTRAINT "gift_card_denominations_giftCardProductId_fkey" FOREIGN KEY ("giftCardProductId") REFERENCES "gift_card_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gift_card_codes" ADD CONSTRAINT "gift_card_codes_denominationId_fkey" FOREIGN KEY ("denominationId") REFERENCES "gift_card_denominations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gift_card_codes" ADD CONSTRAINT "gift_card_codes_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gift_card_codes" ADD CONSTRAINT "gift_card_codes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gift_card_codes" ADD CONSTRAINT "gift_card_codes_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gift_card_deliveries" ADD CONSTRAINT "gift_card_deliveries_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gift_card_deliveries" ADD CONSTRAINT "gift_card_deliveries_inventoryCodeId_fkey" FOREIGN KEY ("inventoryCodeId") REFERENCES "gift_card_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
