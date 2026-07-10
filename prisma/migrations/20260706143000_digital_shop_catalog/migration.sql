-- Extend existing enums without removing current values.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED' AFTER 'PENDING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' AFTER 'CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'COMPLETED' AFTER 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED' AFTER 'RECEIVED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED' AFTER 'CANCELLED';

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' AFTER 'PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED' AFTER 'FAILED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED' AFTER 'CANCELLED';

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BKASH' BEFORE 'CARD';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'SSL_COMMERZ' AFTER 'BKASH';

-- Admin/catalog enums.
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'GIFT_CARD', 'GAME_TOP_UP', 'SUBSCRIPTION');
CREATE TYPE "ProductInputType" AS ENUM ('TEXT', 'NUMBER', 'EMAIL', 'PHONE', 'SELECT');
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'REFUNDED');

-- Users/admin support.
ALTER TABLE "users"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Category merchandising support.
ALTER TABLE "categories"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Shared product fields for all shop items.
ALTER TABLE "products"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "subHeading" TEXT,
  ADD COLUMN "brand" TEXT,
  ADD COLUMN "type" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
  ADD COLUMN "thumbnail" TEXT,
  ADD COLUMN "bannerImage" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BDT',
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT;

-- Gift cards.
CREATE TABLE "gift_card_products" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "cardCurrency" TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gift_card_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gift_card_denominations" (
  "id" TEXT NOT NULL,
  "giftCardProductId" TEXT NOT NULL,
  "title" TEXT,
  "bdtPrice" DECIMAL(65,30) NOT NULL,
  "cardValue" DECIMAL(65,30) NOT NULL,
  "cardCurrency" TEXT NOT NULL DEFAULT 'USD',
  "isPopular" BOOLEAN NOT NULL DEFAULT false,
  "stockQuantity" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gift_card_denominations_pkey" PRIMARY KEY ("id")
);

-- Game top-ups.
CREATE TABLE "game_top_up_products" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "gameName" TEXT NOT NULL,
  "gameCurrencyName" TEXT NOT NULL,
  "instructions" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "game_top_up_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_top_up_packages" (
  "id" TEXT NOT NULL,
  "gameTopUpProductId" TEXT NOT NULL,
  "title" TEXT,
  "price" DECIMAL(65,30) NOT NULL,
  "gameCurrencyAmount" INTEGER NOT NULL,
  "isPopular" BOOLEAN NOT NULL DEFAULT false,
  "stockQuantity" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "game_top_up_packages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_top_up_input_fields" (
  "id" TEXT NOT NULL,
  "gameTopUpProductId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "ProductInputType" NOT NULL DEFAULT 'TEXT',
  "placeholder" TEXT,
  "helpText" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "options" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "game_top_up_input_fields_pkey" PRIMARY KEY ("id")
);

-- Subscriptions.
CREATE TABLE "subscription_products" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "platformName" TEXT NOT NULL,
  "instructions" TEXT,
  "isRenewable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "subscription_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_plans" (
  "id" TEXT NOT NULL,
  "subscriptionProductId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "price" DECIMAL(65,30) NOT NULL,
  "durationDays" INTEGER,
  "durationLabel" TEXT,
  "isPopular" BOOLEAN NOT NULL DEFAULT false,
  "stockQuantity" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_input_fields" (
  "id" TEXT NOT NULL,
  "subscriptionProductId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "ProductInputType" NOT NULL DEFAULT 'TEXT',
  "placeholder" TEXT,
  "helpText" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "options" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "subscription_input_fields_pkey" PRIMARY KEY ("id")
);

-- Cart support for selected digital option and customer-entered fields.
DROP INDEX IF EXISTS "cart_items_cartId_productId_key";

ALTER TABLE "cart_items"
  ADD COLUMN "customerInputs" JSONB,
  ADD COLUMN "unitPrice" DECIMAL(65,30),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "giftCardDenominationId" TEXT,
  ADD COLUMN "gameTopUpPackageId" TEXT,
  ADD COLUMN "subscriptionPlanId" TEXT,
  ADD COLUMN "optionKey" TEXT NOT NULL DEFAULT 'default';

-- Orders can now contain digital products without a shipping address.
ALTER TABLE "orders"
  ADD COLUMN "orderNumber" TEXT,
  ADD COLUMN "subtotal" DECIMAL(65,30),
  ADD COLUMN "discountTotal" DECIMAL(65,30) DEFAULT 0,
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "orders" ALTER COLUMN "addressId" DROP NOT NULL;

ALTER TABLE "order_items"
  ADD COLUMN "totalPrice" DECIMAL(65,30),
  ADD COLUMN "productTitle" TEXT,
  ADD COLUMN "productType" "ProductType",
  ADD COLUMN "optionTitle" TEXT,
  ADD COLUMN "customerInputs" JSONB,
  ADD COLUMN "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "fulfillmentReference" TEXT,
  ADD COLUMN "fulfilledAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "giftCardDenominationId" TEXT,
  ADD COLUMN "gameTopUpPackageId" TEXT,
  ADD COLUMN "subscriptionPlanId" TEXT;

-- bKash now, SSL Commerce later.
ALTER TABLE "payments"
  ADD COLUMN "providerPaymentId" TEXT,
  ADD COLUMN "merchantInvoiceNumber" TEXT,
  ADD COLUMN "payerAccount" TEXT,
  ADD COLUMN "amount" DECIMAL(65,30),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BDT',
  ADD COLUMN "rawResponse" JSONB,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes and constraints.
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_isActive_idx" ON "categories"("isActive");
CREATE INDEX "categories_sortOrder_idx" ON "categories"("sortOrder");

CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_type_idx" ON "products"("type");
CREATE INDEX "products_brand_idx" ON "products"("brand");
CREATE INDEX "products_sortOrder_idx" ON "products"("sortOrder");

CREATE UNIQUE INDEX "gift_card_products_productId_key" ON "gift_card_products"("productId");
CREATE INDEX "gift_card_products_brand_idx" ON "gift_card_products"("brand");
CREATE INDEX "gift_card_denominations_giftCardProductId_idx" ON "gift_card_denominations"("giftCardProductId");
CREATE INDEX "gift_card_denominations_bdtPrice_idx" ON "gift_card_denominations"("bdtPrice");
CREATE INDEX "gift_card_denominations_isActive_idx" ON "gift_card_denominations"("isActive");
CREATE INDEX "gift_card_denominations_sortOrder_idx" ON "gift_card_denominations"("sortOrder");

CREATE UNIQUE INDEX "game_top_up_products_productId_key" ON "game_top_up_products"("productId");
CREATE INDEX "game_top_up_products_gameName_idx" ON "game_top_up_products"("gameName");
CREATE INDEX "game_top_up_packages_gameTopUpProductId_idx" ON "game_top_up_packages"("gameTopUpProductId");
CREATE INDEX "game_top_up_packages_price_idx" ON "game_top_up_packages"("price");
CREATE INDEX "game_top_up_packages_isActive_idx" ON "game_top_up_packages"("isActive");
CREATE INDEX "game_top_up_packages_sortOrder_idx" ON "game_top_up_packages"("sortOrder");
CREATE UNIQUE INDEX "game_top_up_input_fields_gameTopUpProductId_name_key" ON "game_top_up_input_fields"("gameTopUpProductId", "name");
CREATE INDEX "game_top_up_input_fields_gameTopUpProductId_idx" ON "game_top_up_input_fields"("gameTopUpProductId");
CREATE INDEX "game_top_up_input_fields_sortOrder_idx" ON "game_top_up_input_fields"("sortOrder");
CREATE INDEX "game_top_up_input_fields_isActive_idx" ON "game_top_up_input_fields"("isActive");

CREATE UNIQUE INDEX "subscription_products_productId_key" ON "subscription_products"("productId");
CREATE INDEX "subscription_products_platformName_idx" ON "subscription_products"("platformName");
CREATE INDEX "subscription_plans_subscriptionProductId_idx" ON "subscription_plans"("subscriptionProductId");
CREATE INDEX "subscription_plans_price_idx" ON "subscription_plans"("price");
CREATE INDEX "subscription_plans_isActive_idx" ON "subscription_plans"("isActive");
CREATE INDEX "subscription_plans_sortOrder_idx" ON "subscription_plans"("sortOrder");
CREATE UNIQUE INDEX "subscription_input_fields_subscriptionProductId_name_key" ON "subscription_input_fields"("subscriptionProductId", "name");
CREATE INDEX "subscription_input_fields_subscriptionProductId_idx" ON "subscription_input_fields"("subscriptionProductId");
CREATE INDEX "subscription_input_fields_sortOrder_idx" ON "subscription_input_fields"("sortOrder");
CREATE INDEX "subscription_input_fields_isActive_idx" ON "subscription_input_fields"("isActive");

CREATE UNIQUE INDEX "cart_items_cartId_productId_optionKey_key" ON "cart_items"("cartId", "productId", "optionKey");
CREATE INDEX "cart_items_giftCardDenominationId_idx" ON "cart_items"("giftCardDenominationId");
CREATE INDEX "cart_items_gameTopUpPackageId_idx" ON "cart_items"("gameTopUpPackageId");
CREATE INDEX "cart_items_subscriptionPlanId_idx" ON "cart_items"("subscriptionPlanId");

CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE INDEX "orders_userId_idx" ON "orders"("userId");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_paymentStatus_idx" ON "orders"("paymentStatus");
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");
CREATE INDEX "order_items_giftCardDenominationId_idx" ON "order_items"("giftCardDenominationId");
CREATE INDEX "order_items_gameTopUpPackageId_idx" ON "order_items"("gameTopUpPackageId");
CREATE INDEX "order_items_subscriptionPlanId_idx" ON "order_items"("subscriptionPlanId");
CREATE INDEX "order_items_deliveryStatus_idx" ON "order_items"("deliveryStatus");

CREATE INDEX "payments_paymentMethod_idx" ON "payments"("paymentMethod");
CREATE INDEX "payments_paymentStatus_idx" ON "payments"("paymentStatus");
CREATE INDEX "payments_transactionId_idx" ON "payments"("transactionId");
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- Relations.
ALTER TABLE "products" ADD CONSTRAINT "products_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gift_card_products" ADD CONSTRAINT "gift_card_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gift_card_denominations" ADD CONSTRAINT "gift_card_denominations_giftCardProductId_fkey" FOREIGN KEY ("giftCardProductId") REFERENCES "gift_card_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "game_top_up_products" ADD CONSTRAINT "game_top_up_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_top_up_packages" ADD CONSTRAINT "game_top_up_packages_gameTopUpProductId_fkey" FOREIGN KEY ("gameTopUpProductId") REFERENCES "game_top_up_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_top_up_input_fields" ADD CONSTRAINT "game_top_up_input_fields_gameTopUpProductId_fkey" FOREIGN KEY ("gameTopUpProductId") REFERENCES "game_top_up_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_products" ADD CONSTRAINT "subscription_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_subscriptionProductId_fkey" FOREIGN KEY ("subscriptionProductId") REFERENCES "subscription_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_input_fields" ADD CONSTRAINT "subscription_input_fields_subscriptionProductId_fkey" FOREIGN KEY ("subscriptionProductId") REFERENCES "subscription_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_giftCardDenominationId_fkey" FOREIGN KEY ("giftCardDenominationId") REFERENCES "gift_card_denominations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_gameTopUpPackageId_fkey" FOREIGN KEY ("gameTopUpPackageId") REFERENCES "game_top_up_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_giftCardDenominationId_fkey" FOREIGN KEY ("giftCardDenominationId") REFERENCES "gift_card_denominations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_gameTopUpPackageId_fkey" FOREIGN KEY ("gameTopUpPackageId") REFERENCES "game_top_up_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
