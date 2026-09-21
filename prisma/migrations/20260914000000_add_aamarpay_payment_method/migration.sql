-- Preserve historical payment methods and records; add the new gateway only.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'AAMARPAY';
ALTER TABLE "payments" ALTER COLUMN "paymentProvider" SET DEFAULT 'aamarpay';
