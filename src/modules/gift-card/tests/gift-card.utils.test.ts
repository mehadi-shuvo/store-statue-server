import assert from "node:assert/strict";
import test from "node:test";
import {
  bulkInventoryCodeSchema,
  createDenominationSchema,
  createGiftCardSchema,
  deliveryEmailSchema,
} from "../gift-card.validation";
import { createGiftCardOrderNumber, maskGiftCardCode, moneyString } from "../gift-card.utils";
import { validateRequest } from "../../../middlewares/validate.middleware";
import { publicGiftCardQuerySchema } from "../gift-card.validation";
import { authorizeRoles } from "../../../middlewares/auth.middleware";
import { UserRole } from "../../../generated/prisma/client";
import { ApiAppError } from "../../../utils/apiAppError";
import { authenticateUser } from "../../../middlewares/auth.middleware";
import { ENV } from "../../../utils/env-config";
import { decryptGiftCardSecret, encryptGiftCardSecret, giftCardSecretHash } from "../gift-card-crypto";

test("inventory codes are masked without exposing middle segments", () => {
  assert.equal(maskGiftCardCode("AMZN-1111-AAAA"), "AMZN-****-AAAA");
  assert.equal(maskGiftCardCode("ABCD1234EFGH"), "ABCD****EFGH");
});

test("gift-card secrets use authenticated encryption and deterministic keyed fingerprints", () => {
  const previous = ENV.GIFT_CARD_ENCRYPTION_KEY;
  ENV.GIFT_CARD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const encrypted = encryptGiftCardSecret("SECRET-CODE")!;
    assert.notEqual(encrypted, "SECRET-CODE");
    assert.equal(decryptGiftCardSecret(encrypted), "SECRET-CODE");
    assert.equal(giftCardSecretHash("SECRET-CODE"), giftCardSecretHash("SECRET-CODE"));
  } finally {
    ENV.GIFT_CARD_ENCRYPTION_KEY = previous;
  }
});

test("money is serialized to two decimal places", () => {
  assert.equal(moneyString("1280"), "1280.00");
  assert.equal(moneyString("10.5"), "10.50");
});

test("order numbers use the gift-card prefix and purchase date", () => {
  assert.match(createGiftCardOrderNumber(new Date("2026-08-15T00:00:00.000Z")), /^GC-20260815-[A-F0-9]{10}$/);
});

test("admin product input accepts URL or frontend asset-path metadata", () => {
  const parsed = createGiftCardSchema.parse({
    name: "Amazon Gift Card",
    slug: "amazon-gift-card",
    brand: "Amazon",
    imageUrl: "/images/gift-cards/amazon.png",
    currency: "usd",
  });
  assert.equal(parsed.currency, "USD");
});

test("denomination input rejects floating numbers and non-positive decimal strings", () => {
  assert.equal(createDenominationSchema.safeParse({ faceValue: 10, faceCurrency: "USD", sellingPriceBdt: "1280.00" }).success, false);
  assert.equal(createDenominationSchema.safeParse({ faceValue: "0", faceCurrency: "USD", sellingPriceBdt: "1280.00" }).success, false);
  assert.equal(createDenominationSchema.safeParse({ faceValue: "10.00", faceCurrency: "USD", sellingPriceBdt: "1280.00" }).success, true);
});

test("custom delivery requires and normalizes an email", () => {
  assert.equal(deliveryEmailSchema.safeParse({ useAccountEmail: false }).success, false);
  const parsed = deliveryEmailSchema.parse({ useAccountEmail: false, deliveryEmail: " Customer@Example.COM " });
  assert.equal(parsed.deliveryEmail, "customer@example.com");
});

test("bulk inventory validation rejects empty batches", () => {
  assert.equal(bulkInventoryCodeSchema.safeParse({ codes: [] }).success, false);
});

test("query validation works with the Express 5 getter-only query property", () => {
  const request = Object.create({});
  Object.defineProperty(request, "query", {
    get: () => ({ page: "2", limit: "5" }),
    configurable: true,
  });
  let nextError: unknown;
  validateRequest({ query: publicGiftCardQuerySchema })(request, {} as never, (error?: unknown) => {
    nextError = error;
  });
  assert.equal(nextError, undefined);
  assert.equal(request.query.page, 2);
  assert.equal(request.query.limit, 5);
});

test("customer role is denied by admin authorization middleware", () => {
  let nextError: unknown;
  authorizeRoles(UserRole.ADMIN)(
    { authUser: { id: "customer", email: "customer@example.test", role: UserRole.CUSTOMER } } as never,
    {} as never,
    (error?: unknown) => { nextError = error; },
  );
  assert.ok(nextError instanceof ApiAppError);
  assert.equal((nextError as ApiAppError).statusCode, 403);
});

test("unauthenticated checkout authentication is rejected", async () => {
  let nextError: unknown;
  await authenticateUser(
    { headers: {}, cookies: {} } as never,
    {} as never,
    (error?: unknown) => { nextError = error; },
  );
  assert.ok(nextError instanceof ApiAppError);
  assert.equal((nextError as ApiAppError).statusCode, 401);
});
