-- Reconcile the database created by 20260706143000_digital_shop_catalog with
-- the current split digital-catalog Prisma schema. Legacy rows are copied to
-- archive tables before the old generic products table is removed.

-- Refuse to guess how historical physical order items should map to a digital
-- product. The migration can be retried after those rows receive an explicit
-- business-approved archival/mapping strategy.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "order_items" oi
    JOIN "products" p ON p."id" = oi."productId"
    WHERE p."type" = 'PHYSICAL'
  ) THEN
    RAISE EXCEPTION 'Cannot migrate while physical order items exist; migrate that order history explicitly first';
  END IF;
END $$;

CREATE TYPE "DigitalProductType" AS ENUM ('GIFT_CARD', 'GAME_TOP_UP', 'SUBSCRIPTION');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'ARCHIVED');
CREATE TYPE "GiftCardDeliveryType" AS ENUM ('CODE', 'LINK', 'MANUAL', 'ACCOUNT_RECHARGE');
CREATE TYPE "GiftCardRegion" AS ENUM ('GLOBAL', 'USA', 'UK', 'CANADA', 'EUROPE', 'AUSTRALIA', 'INDIA', 'BANGLADESH', 'SINGAPORE', 'JAPAN', 'UAE', 'OTHER');
CREATE TYPE "GameTopUpFulfillmentType" AS ENUM ('PLAYER_ID', 'PLAYER_ID_AND_SERVER', 'EMAIL', 'PHONE', 'LOGIN_CREDENTIALS', 'REDEEM_CODE', 'MANUAL');
CREATE TYPE "SubscriptionDeliveryType" AS ENUM ('ACCOUNT_CREDENTIALS', 'CUSTOMER_ACCOUNT_ACTIVATION', 'FAMILY_INVITATION', 'REDEEM_CODE', 'LICENSE_KEY', 'MANUAL');
CREATE TYPE "SubscriptionBillingCycle" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'LIFETIME', 'CUSTOM');

-- Normalize values removed from existing enums before replacing those types.
UPDATE "orders" SET "status" = 'COMPLETED' WHERE "status"::text IN ('DELIVERED', 'RECEIVED');
UPDATE "order_items" SET "deliveryStatus" = 'DELIVERED' WHERE "deliveryStatus"::text = 'NOT_REQUIRED';
UPDATE "payments" SET "paymentMethod" = 'CARD' WHERE "paymentMethod"::text = 'SSL_COMMERZ';
UPDATE "payments" SET "paymentMethod" = 'CASH_ON_DELIVERY' WHERE "paymentMethod"::text = 'MOBILE_BANKING';

ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "order_items" ALTER COLUMN "deliveryStatus" DROP DEFAULT;

CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE TYPE "DeliveryStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'CANCELLED', 'REFUNDED');
ALTER TABLE "order_items" ALTER COLUMN "deliveryStatus" TYPE "DeliveryStatus_new" USING ("deliveryStatus"::text::"DeliveryStatus_new");
ALTER TYPE "DeliveryStatus" RENAME TO "DeliveryStatus_old";
ALTER TYPE "DeliveryStatus_new" RENAME TO "DeliveryStatus";
DROP TYPE "DeliveryStatus_old";
ALTER TABLE "order_items" ALTER COLUMN "deliveryStatus" SET DEFAULT 'PENDING';

CREATE TYPE "PaymentMethod_new" AS ENUM ('BKASH', 'NAGAD', 'ROCKET', 'CARD', 'BANK_TRANSFER', 'CASH', 'MANUAL');
ALTER TABLE "payments" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new"
USING (
  CASE "paymentMethod"::text
    WHEN 'CASH_ON_DELIVERY' THEN 'CASH'
    ELSE "paymentMethod"::text
  END
)::"PaymentMethod_new";
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "PaymentMethod_old";

ALTER TYPE "PaymentStatus" ADD VALUE 'INITIATED';
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';
ALTER TYPE "ProductInputType" ADD VALUE 'RADIO';
ALTER TYPE "ProductInputType" ADD VALUE 'TEXTAREA';
ALTER TYPE "UserRole" ADD VALUE 'STAFF';

-- Preserve all generic product rows and removed physical-cart/review rows in a
-- separate schema so they do not become unmanaged public Prisma tables.
CREATE SCHEMA IF NOT EXISTS "legacy_archive";
CREATE TABLE "legacy_archive"."products" AS
SELECT
  "id", "title", "description", "price", "stockQuantity", "isActive",
  "createdAt", "categoryId", "features", "offerPercent", "photos", "slug",
  "subHeading", "brand", "type"::text AS "type", "thumbnail", "bannerImage",
  "currency", "sortOrder", "updatedAt", "deletedAt", "createdById", "updatedById"
FROM "products";
ALTER TABLE "legacy_archive"."products" ADD COLUMN "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "legacy_archive"."physical_cart_items" AS
SELECT ci.*, CURRENT_TIMESTAMP AS "archivedAt"
FROM "cart_items" ci
JOIN "products" p ON p."id" = ci."productId"
WHERE p."type" = 'PHYSICAL';

CREATE TABLE "legacy_archive"."physical_reviews" AS
SELECT r.*, CURRENT_TIMESTAMP AS "archivedAt"
FROM "reviews" r
JOIN "products" p ON p."id" = r."productId"
WHERE p."type" = 'PHYSICAL';

DELETE FROM "cart_items"
USING "products"
WHERE "cart_items"."productId" = "products"."id" AND "products"."type" = 'PHYSICAL';
DELETE FROM "reviews"
USING "products"
WHERE "reviews"."productId" = "products"."id" AND "products"."type" = 'PHYSICAL';

-- Drop old relations and indexes before changing keys and columns.
ALTER TABLE "OTP" DROP CONSTRAINT "OTP_userId_fkey";
ALTER TABLE "addresses" DROP CONSTRAINT "addresses_userId_fkey";
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_cartId_fkey";
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_productId_fkey";
ALTER TABLE "carts" DROP CONSTRAINT "carts_userId_fkey";
ALTER TABLE "game_top_up_input_fields" DROP CONSTRAINT "game_top_up_input_fields_gameTopUpProductId_fkey";
ALTER TABLE "game_top_up_packages" DROP CONSTRAINT "game_top_up_packages_gameTopUpProductId_fkey";
ALTER TABLE "game_top_up_products" DROP CONSTRAINT "game_top_up_products_productId_fkey";
ALTER TABLE "gift_card_denominations" DROP CONSTRAINT "gift_card_denominations_giftCardProductId_fkey";
ALTER TABLE "gift_card_products" DROP CONSTRAINT "gift_card_products_productId_fkey";
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_orderId_fkey";
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_productId_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_addressId_fkey";
ALTER TABLE "products" DROP CONSTRAINT "products_categoryId_fkey";
ALTER TABLE "products" DROP CONSTRAINT "products_createdById_fkey";
ALTER TABLE "products" DROP CONSTRAINT "products_updatedById_fkey";
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_productId_fkey";
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_userId_fkey";
ALTER TABLE "subscription_input_fields" DROP CONSTRAINT "subscription_input_fields_subscriptionProductId_fkey";
ALTER TABLE "subscription_plans" DROP CONSTRAINT "subscription_plans_subscriptionProductId_fkey";
ALTER TABLE "subscription_products" DROP CONSTRAINT "subscription_products_productId_fkey";

DROP INDEX "cart_items_cartId_productId_optionKey_key";
DROP INDEX "game_top_up_packages_price_idx";
DROP INDEX "game_top_up_products_gameName_idx";
DROP INDEX "game_top_up_products_productId_key";
DROP INDEX "gift_card_denominations_bdtPrice_idx";
DROP INDEX "gift_card_products_productId_key";
DROP INDEX "order_items_productId_idx";
DROP INDEX "payments_paymentId_idx";
DROP INDEX "reviews_userId_productId_key";
DROP INDEX "subscription_plans_price_idx";
DROP INDEX "subscription_products_productId_key";

-- Core records.
ALTER TABLE "addresses"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "postalCode" DROP NOT NULL;
ALTER TABLE "addresses" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "carts" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "categories"
SET "slug" = 'category-' || "id"
WHERE "slug" IS NULL OR btrim("slug") = '';
ALTER TABLE "categories"
  ADD COLUMN "image" TEXT,
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "users" ALTER COLUMN "updatedAt" DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "users" WHERE "phone" IS NOT NULL
    GROUP BY "phone" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add users.phone uniqueness because duplicate phone numbers exist';
  END IF;
END $$;

-- Gift cards: copy shared product data, then make the old generic product id
-- the canonical public id. ON UPDATE CASCADE preserves option references.
ALTER TABLE "gift_card_products"
  ADD COLUMN "bannerImage" TEXT,
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deliveryType" "GiftCardDeliveryType" NOT NULL DEFAULT 'CODE',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "image" TEXT,
  ADD COLUMN "instructions" TEXT,
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "region" "GiftCardRegion" NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "termsAndConditions" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "updatedById" TEXT;

UPDATE "gift_card_products" g
SET
  "bannerImage" = p."bannerImage",
  "categoryId" = p."categoryId",
  "createdById" = p."createdById",
  "deletedAt" = p."deletedAt",
  "description" = p."description",
  "image" = COALESCE(NULLIF(p."thumbnail", ''), p."photos"[1], ''),
  "slug" = COALESCE(NULLIF(p."slug", ''), 'gift-card-' || p."id"),
  "sortOrder" = p."sortOrder",
  "status" = CASE WHEN p."deletedAt" IS NOT NULL THEN 'ARCHIVED'::"ProductStatus" WHEN p."isActive" THEN 'ACTIVE'::"ProductStatus" ELSE 'INACTIVE'::"ProductStatus" END,
  "title" = p."title",
  "updatedById" = p."updatedById"
FROM "products" p
WHERE p."id" = g."productId";

UPDATE "gift_card_products" SET "id" = "productId";
ALTER TABLE "gift_card_products"
  DROP COLUMN "productId",
  ALTER COLUMN "image" SET NOT NULL,
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "title" SET NOT NULL,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "gift_card_denominations" ADD COLUMN "sellingPriceBDT" DECIMAL(12,2);
UPDATE "gift_card_denominations" SET "sellingPriceBDT" = "bdtPrice";
ALTER TABLE "gift_card_denominations"
  DROP COLUMN "bdtPrice",
  ADD COLUMN "costPriceBDT" DECIMAL(12,2),
  ADD COLUMN "discountAmountBDT" DECIMAL(12,2),
  ADD COLUMN "discountLabel" TEXT,
  ADD COLUMN "discountPercent" DECIMAL(5,2),
  ALTER COLUMN "sellingPriceBDT" SET NOT NULL,
  ALTER COLUMN "cardValue" TYPE DECIMAL(12,2),
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Game top-ups.
ALTER TABLE "game_top_up_products"
  ADD COLUMN "bannerImage" TEXT,
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "description" TEXT,
  ADD COLUMN "estimatedDelivery" TEXT,
  ADD COLUMN "fulfillmentType" "GameTopUpFulfillmentType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "logo" TEXT,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "subHeading" TEXT,
  ADD COLUMN "termsAndConditions" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "updatedById" TEXT;

UPDATE "game_top_up_products" g
SET
  "bannerImage" = p."bannerImage",
  "categoryId" = p."categoryId",
  "createdById" = p."createdById",
  "deletedAt" = p."deletedAt",
  "description" = p."description",
  "logo" = COALESCE(NULLIF(p."thumbnail", ''), p."photos"[1], ''),
  "name" = g."gameName",
  "slug" = COALESCE(NULLIF(p."slug", ''), 'top-up-' || p."id"),
  "sortOrder" = p."sortOrder",
  "status" = CASE WHEN p."deletedAt" IS NOT NULL THEN 'ARCHIVED'::"ProductStatus" WHEN p."isActive" THEN 'ACTIVE'::"ProductStatus" ELSE 'INACTIVE'::"ProductStatus" END,
  "subHeading" = p."subHeading",
  "title" = p."title",
  "updatedById" = p."updatedById"
FROM "products" p
WHERE p."id" = g."productId";

UPDATE "game_top_up_products" SET "id" = "productId";
ALTER TABLE "game_top_up_products"
  DROP COLUMN "gameName",
  DROP COLUMN "productId",
  ALTER COLUMN "logo" SET NOT NULL,
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "title" SET NOT NULL,
  ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "game_top_up_products" ALTER COLUMN "fulfillmentType" DROP DEFAULT;

ALTER TABLE "game_top_up_packages" ADD COLUMN "sellingPriceBDT" DECIMAL(12,2);
UPDATE "game_top_up_packages" SET "sellingPriceBDT" = "price";
ALTER TABLE "game_top_up_packages"
  DROP COLUMN "price",
  ADD COLUMN "bonusCurrencyAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "costPriceBDT" DECIMAL(12,2),
  ADD COLUMN "discountAmountBDT" DECIMAL(12,2),
  ADD COLUMN "discountLabel" TEXT,
  ADD COLUMN "discountPercent" DECIMAL(5,2),
  ALTER COLUMN "sellingPriceBDT" SET NOT NULL,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "game_top_up_input_fields"
  ADD COLUMN "validationRules" JSONB,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Subscriptions.
ALTER TABLE "subscription_products"
  ADD COLUMN "bannerImage" TEXT,
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deliveryType" "SubscriptionDeliveryType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "estimatedDelivery" TEXT,
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "logo" TEXT,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "subHeading" TEXT,
  ADD COLUMN "termsAndConditions" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "updatedById" TEXT;

UPDATE "subscription_products" s
SET
  "bannerImage" = p."bannerImage",
  "categoryId" = p."categoryId",
  "createdById" = p."createdById",
  "deletedAt" = p."deletedAt",
  "description" = p."description",
  "logo" = COALESCE(NULLIF(p."thumbnail", ''), p."photos"[1], ''),
  "slug" = COALESCE(NULLIF(p."slug", ''), 'subscription-' || p."id"),
  "sortOrder" = p."sortOrder",
  "status" = CASE WHEN p."deletedAt" IS NOT NULL THEN 'ARCHIVED'::"ProductStatus" WHEN p."isActive" THEN 'ACTIVE'::"ProductStatus" ELSE 'INACTIVE'::"ProductStatus" END,
  "subHeading" = p."subHeading",
  "title" = p."title",
  "updatedById" = p."updatedById"
FROM "products" p
WHERE p."id" = s."productId";

UPDATE "subscription_products" SET "id" = "productId";
ALTER TABLE "subscription_products"
  DROP COLUMN "productId",
  ALTER COLUMN "logo" SET NOT NULL,
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "title" SET NOT NULL,
  ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "subscription_products" ALTER COLUMN "deliveryType" DROP DEFAULT;

ALTER TABLE "subscription_plans" ADD COLUMN "sellingPriceBDT" DECIMAL(12,2);
UPDATE "subscription_plans" SET "sellingPriceBDT" = "price";
ALTER TABLE "subscription_plans"
  DROP COLUMN "price",
  ADD COLUMN "accountType" TEXT,
  ADD COLUMN "billingCycle" "SubscriptionBillingCycle" NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN "costPriceBDT" DECIMAL(12,2),
  ADD COLUMN "description" TEXT,
  ADD COLUMN "discountAmountBDT" DECIMAL(12,2),
  ADD COLUMN "discountLabel" TEXT,
  ADD COLUMN "discountPercent" DECIMAL(5,2),
  ADD COLUMN "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "maxDevices" INTEGER,
  ADD COLUMN "maxUsers" INTEGER,
  ADD COLUMN "profileCount" INTEGER,
  ADD COLUMN "screenCount" INTEGER,
  ADD COLUMN "subscriptionTier" TEXT,
  ALTER COLUMN "sellingPriceBDT" SET NOT NULL,
  ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "subscription_plans" ALTER COLUMN "billingCycle" DROP DEFAULT;

ALTER TABLE "subscription_input_fields"
  ADD COLUMN "validationRules" JSONB,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Reviews, carts, and order items now reference the canonical split product.
ALTER TABLE "reviews"
  ADD COLUMN "gameTopUpProductId" TEXT,
  ADD COLUMN "giftCardProductId" TEXT,
  ADD COLUMN "productType" "DigitalProductType",
  ADD COLUMN "subscriptionProductId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "reviews" r
SET
  "productType" = p."type"::text::"DigitalProductType",
  "giftCardProductId" = CASE WHEN p."type" = 'GIFT_CARD' THEN p."id" END,
  "gameTopUpProductId" = CASE WHEN p."type" = 'GAME_TOP_UP' THEN p."id" END,
  "subscriptionProductId" = CASE WHEN p."type" = 'SUBSCRIPTION' THEN p."id" END
FROM "products" p
WHERE p."id" = r."productId";
ALTER TABLE "reviews"
  DROP COLUMN "productId",
  ALTER COLUMN "productType" SET NOT NULL,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "cart_items"
  ADD COLUMN "gameTopUpProductId" TEXT,
  ADD COLUMN "giftCardProductId" TEXT,
  ADD COLUMN "productType" "DigitalProductType",
  ADD COLUMN "subscriptionProductId" TEXT;
UPDATE "cart_items" ci
SET
  "productType" = p."type"::text::"DigitalProductType",
  "giftCardProductId" = CASE WHEN p."type" = 'GIFT_CARD' THEN p."id" END,
  "gameTopUpProductId" = CASE WHEN p."type" = 'GAME_TOP_UP' THEN p."id" END,
  "subscriptionProductId" = CASE WHEN p."type" = 'SUBSCRIPTION' THEN p."id" END,
  "unitPrice" = COALESCE(ci."unitPrice", p."price")
FROM "products" p
WHERE p."id" = ci."productId";
ALTER TABLE "cart_items"
  DROP COLUMN "productId",
  ALTER COLUMN "productType" SET NOT NULL,
  ALTER COLUMN "quantity" SET DEFAULT 1,
  ALTER COLUMN "unitPrice" SET NOT NULL,
  ALTER COLUMN "unitPrice" TYPE DECIMAL(12,2),
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "optionKey" DROP DEFAULT;

ALTER TABLE "order_items"
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "fulfillmentData" JSONB,
  ADD COLUMN "gameTopUpProductId" TEXT,
  ADD COLUMN "giftCardProductId" TEXT,
  ADD COLUMN "productImage" TEXT,
  ADD COLUMN "subscriptionProductId" TEXT,
  ADD COLUMN "unitPrice" DECIMAL(12,2),
  ADD COLUMN "digitalProductType" "DigitalProductType";
UPDATE "order_items" oi
SET
  "digitalProductType" = p."type"::text::"DigitalProductType",
  "giftCardProductId" = CASE WHEN p."type" = 'GIFT_CARD' THEN p."id" END,
  "gameTopUpProductId" = CASE WHEN p."type" = 'GAME_TOP_UP' THEN p."id" END,
  "subscriptionProductId" = CASE WHEN p."type" = 'SUBSCRIPTION' THEN p."id" END,
  "unitPrice" = oi."price",
  "totalPrice" = COALESCE(oi."totalPrice", oi."price" * oi."quantity"),
  "productTitle" = COALESCE(oi."productTitle", p."title"),
  "productImage" = p."thumbnail"
FROM "products" p
WHERE p."id" = oi."productId";
ALTER TABLE "order_items"
  DROP COLUMN "price",
  DROP COLUMN "productId",
  DROP COLUMN "productType";
ALTER TABLE "order_items" RENAME COLUMN "digitalProductType" TO "productType";
ALTER TABLE "order_items"
  ALTER COLUMN "productType" SET NOT NULL,
  ALTER COLUMN "unitPrice" SET NOT NULL,
  ALTER COLUMN "quantity" SET DEFAULT 1,
  ALTER COLUMN "totalPrice" SET NOT NULL,
  ALTER COLUMN "totalPrice" TYPE DECIMAL(12,2),
  ALTER COLUMN "productTitle" SET NOT NULL,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

UPDATE "orders"
SET
  "orderNumber" = COALESCE("orderNumber", 'ORD-' || "id"),
  "subtotal" = COALESCE("subtotal", "totalCost"),
  "discountTotal" = COALESCE("discountTotal", 0);
ALTER TABLE "orders"
  ALTER COLUMN "totalCost" TYPE DECIMAL(12,2),
  ALTER COLUMN "orderNumber" SET NOT NULL,
  ALTER COLUMN "subtotal" SET NOT NULL,
  ALTER COLUMN "subtotal" TYPE DECIMAL(12,2),
  ALTER COLUMN "discountTotal" SET NOT NULL,
  ALTER COLUMN "discountTotal" TYPE DECIMAL(12,2),
  ALTER COLUMN "updatedAt" DROP DEFAULT;

UPDATE "payments" p
SET "amount" = COALESCE(p."amount", o."totalCost")
FROM "orders" o
WHERE o."id" = p."orderId";
ALTER TABLE "payments"
  ALTER COLUMN "amount" SET NOT NULL,
  ALTER COLUMN "amount" TYPE DECIMAL(12,2),
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- OTP values are short-lived and their meanings changed. Archive them intact
-- and create the current table rather than assigning misleading new types.
CREATE TABLE "legacy_archive"."otps" AS
SELECT "id", "code", "type"::text AS "type", "expiresAt", "used", "userId", "createdAt"
FROM "OTP";
DROP TABLE "OTP";
DROP TYPE "OtpType";
CREATE TYPE "OtpType" AS ENUM ('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'LOGIN');
CREATE TABLE "otps" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "OtpType" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

DROP TABLE "products";
DROP TYPE "ProductType";

CREATE TABLE "gift_card_codes" (
  "id" TEXT NOT NULL,
  "denominationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "pin" TEXT,
  "serialNo" TEXT,
  "expiryDate" TIMESTAMP(3),
  "isSold" BOOLEAN NOT NULL DEFAULT false,
  "soldAt" TIMESTAMP(3),
  "orderItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gift_card_codes_pkey" PRIMARY KEY ("id")
);

-- Indexes.
CREATE INDEX "otps_userId_type_idx" ON "otps"("userId", "type");
CREATE INDEX "otps_expiresAt_idx" ON "otps"("expiresAt");
CREATE UNIQUE INDEX "gift_card_codes_orderItemId_key" ON "gift_card_codes"("orderItemId");
CREATE INDEX "gift_card_codes_denominationId_idx" ON "gift_card_codes"("denominationId");
CREATE INDEX "gift_card_codes_isSold_idx" ON "gift_card_codes"("isSold");
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");
CREATE INDEX "cart_items_giftCardProductId_idx" ON "cart_items"("giftCardProductId");
CREATE INDEX "cart_items_gameTopUpProductId_idx" ON "cart_items"("gameTopUpProductId");
CREATE INDEX "cart_items_subscriptionProductId_idx" ON "cart_items"("subscriptionProductId");
CREATE UNIQUE INDEX "cart_items_cartId_productType_optionKey_key" ON "cart_items"("cartId", "productType", "optionKey");
CREATE INDEX "game_top_up_packages_sellingPriceBDT_idx" ON "game_top_up_packages"("sellingPriceBDT");
CREATE INDEX "game_top_up_packages_isPopular_idx" ON "game_top_up_packages"("isPopular");
CREATE UNIQUE INDEX "game_top_up_packages_gameTopUpProductId_gameCurrencyAmount__key" ON "game_top_up_packages"("gameTopUpProductId", "gameCurrencyAmount", "bonusCurrencyAmount");
CREATE UNIQUE INDEX "game_top_up_products_slug_key" ON "game_top_up_products"("slug");
CREATE INDEX "game_top_up_products_name_idx" ON "game_top_up_products"("name");
CREATE INDEX "game_top_up_products_categoryId_idx" ON "game_top_up_products"("categoryId");
CREATE INDEX "game_top_up_products_status_idx" ON "game_top_up_products"("status");
CREATE INDEX "game_top_up_products_isFeatured_idx" ON "game_top_up_products"("isFeatured");
CREATE INDEX "game_top_up_products_sortOrder_idx" ON "game_top_up_products"("sortOrder");
CREATE INDEX "gift_card_denominations_sellingPriceBDT_idx" ON "gift_card_denominations"("sellingPriceBDT");
CREATE INDEX "gift_card_denominations_isPopular_idx" ON "gift_card_denominations"("isPopular");
CREATE UNIQUE INDEX "gift_card_denominations_giftCardProductId_cardValue_cardCur_key" ON "gift_card_denominations"("giftCardProductId", "cardValue", "cardCurrency");
CREATE UNIQUE INDEX "gift_card_products_slug_key" ON "gift_card_products"("slug");
CREATE INDEX "gift_card_products_categoryId_idx" ON "gift_card_products"("categoryId");
CREATE INDEX "gift_card_products_status_idx" ON "gift_card_products"("status");
CREATE INDEX "gift_card_products_isFeatured_idx" ON "gift_card_products"("isFeatured");
CREATE INDEX "gift_card_products_sortOrder_idx" ON "gift_card_products"("sortOrder");
CREATE INDEX "order_items_productType_idx" ON "order_items"("productType");
CREATE INDEX "order_items_giftCardProductId_idx" ON "order_items"("giftCardProductId");
CREATE INDEX "order_items_gameTopUpProductId_idx" ON "order_items"("gameTopUpProductId");
CREATE INDEX "order_items_subscriptionProductId_idx" ON "order_items"("subscriptionProductId");
CREATE INDEX "reviews_productType_idx" ON "reviews"("productType");
CREATE INDEX "reviews_giftCardProductId_idx" ON "reviews"("giftCardProductId");
CREATE INDEX "reviews_gameTopUpProductId_idx" ON "reviews"("gameTopUpProductId");
CREATE INDEX "reviews_subscriptionProductId_idx" ON "reviews"("subscriptionProductId");
CREATE UNIQUE INDEX "reviews_userId_giftCardProductId_key" ON "reviews"("userId", "giftCardProductId");
CREATE UNIQUE INDEX "reviews_userId_gameTopUpProductId_key" ON "reviews"("userId", "gameTopUpProductId");
CREATE UNIQUE INDEX "reviews_userId_subscriptionProductId_key" ON "reviews"("userId", "subscriptionProductId");
CREATE INDEX "subscription_plans_sellingPriceBDT_idx" ON "subscription_plans"("sellingPriceBDT");
CREATE INDEX "subscription_plans_billingCycle_idx" ON "subscription_plans"("billingCycle");
CREATE INDEX "subscription_plans_isPopular_idx" ON "subscription_plans"("isPopular");
CREATE UNIQUE INDEX "subscription_products_slug_key" ON "subscription_products"("slug");
CREATE INDEX "subscription_products_categoryId_idx" ON "subscription_products"("categoryId");
CREATE INDEX "subscription_products_status_idx" ON "subscription_products"("status");
CREATE INDEX "subscription_products_isFeatured_idx" ON "subscription_products"("isFeatured");
CREATE INDEX "subscription_products_sortOrder_idx" ON "subscription_products"("sortOrder");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE INDEX "users_role_idx" ON "users"("role");

-- Relations.
ALTER TABLE "otps" ADD CONSTRAINT "otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gift_card_products" ADD CONSTRAINT "gift_card_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gift_card_products" ADD CONSTRAINT "gift_card_products_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gift_card_products" ADD CONSTRAINT "gift_card_products_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gift_card_denominations" ADD CONSTRAINT "gift_card_denominations_giftCardProductId_fkey" FOREIGN KEY ("giftCardProductId") REFERENCES "gift_card_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gift_card_codes" ADD CONSTRAINT "gift_card_codes_denominationId_fkey" FOREIGN KEY ("denominationId") REFERENCES "gift_card_denominations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gift_card_codes" ADD CONSTRAINT "gift_card_codes_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "game_top_up_products" ADD CONSTRAINT "game_top_up_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "game_top_up_products" ADD CONSTRAINT "game_top_up_products_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "game_top_up_products" ADD CONSTRAINT "game_top_up_products_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "game_top_up_packages" ADD CONSTRAINT "game_top_up_packages_gameTopUpProductId_fkey" FOREIGN KEY ("gameTopUpProductId") REFERENCES "game_top_up_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_top_up_input_fields" ADD CONSTRAINT "game_top_up_input_fields_gameTopUpProductId_fkey" FOREIGN KEY ("gameTopUpProductId") REFERENCES "game_top_up_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_products" ADD CONSTRAINT "subscription_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_products" ADD CONSTRAINT "subscription_products_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_products" ADD CONSTRAINT "subscription_products_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_subscriptionProductId_fkey" FOREIGN KEY ("subscriptionProductId") REFERENCES "subscription_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_input_fields" ADD CONSTRAINT "subscription_input_fields_subscriptionProductId_fkey" FOREIGN KEY ("subscriptionProductId") REFERENCES "subscription_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_giftCardProductId_fkey" FOREIGN KEY ("giftCardProductId") REFERENCES "gift_card_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_gameTopUpProductId_fkey" FOREIGN KEY ("gameTopUpProductId") REFERENCES "game_top_up_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subscriptionProductId_fkey" FOREIGN KEY ("subscriptionProductId") REFERENCES "subscription_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_giftCardProductId_fkey" FOREIGN KEY ("giftCardProductId") REFERENCES "gift_card_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_gameTopUpProductId_fkey" FOREIGN KEY ("gameTopUpProductId") REFERENCES "game_top_up_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_subscriptionProductId_fkey" FOREIGN KEY ("subscriptionProductId") REFERENCES "subscription_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_giftCardProductId_fkey" FOREIGN KEY ("giftCardProductId") REFERENCES "gift_card_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_gameTopUpProductId_fkey" FOREIGN KEY ("gameTopUpProductId") REFERENCES "game_top_up_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_subscriptionProductId_fkey" FOREIGN KEY ("subscriptionProductId") REFERENCES "subscription_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
