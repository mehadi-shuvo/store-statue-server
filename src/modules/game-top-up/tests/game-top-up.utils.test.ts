import assert from "node:assert/strict";
import test from "node:test";
import { ProductInputType } from "../../../generated/prisma/client";
import { getQueueDateKey } from "../game-top-up-queue.service";
import { createAccountFieldSchema, createTopUpOrderSchema } from "../game-top-up.validation";
import { maskAccountDetails, validateAccountDetails } from "../game-top-up.utils";

const playerField = {
  name: "playerId", label: "Player ID", type: ProductInputType.NUMBER,
  isRequired: true, options: null, validationRules: { minLength: 6, maxLength: 12 },
};

test("order input accepts only package id and configured account details", () => {
  assert.equal(createTopUpOrderSchema.safeParse({ packageId: crypto.randomUUID(), accountDetails: { playerId: "123456" } }).success, true);
  assert.equal(createTopUpOrderSchema.safeParse({ packageId: crypto.randomUUID(), price: "1.00", accountDetails: { playerId: "123456" } }).success, false);
});

test("account field configuration rejects credential collection", () => {
  assert.equal(createAccountFieldSchema.safeParse({ key: "facebookPassword", label: "Facebook password" }).success, false);
  assert.equal(createAccountFieldSchema.safeParse({ key: "playerId", label: "Player ID", type: "NUMBER" }).success, true);
});

test("dynamic account validation rejects missing and arbitrary fields", () => {
  assert.throws(() => validateAccountDetails([playerField], {}), (error: any) => error.code === "INVALID_ACCOUNT_DETAILS");
  assert.throws(() => validateAccountDetails([playerField], { playerId: "123456", serverId: "1" }), (error: any) => error.code === "INVALID_ACCOUNT_DETAILS");
  assert.deepEqual(validateAccountDetails([playerField], { playerId: "123456" }), { playerId: "123456" });
});

test("account identifiers are masked for queue and customer list responses", () => {
  assert.deepEqual(maskAccountDetails({ playerId: "123456789", email: "player@example.test" }), {
    playerId: "*****6789",
    email: "p*****@example.test",
  });
});

test("queue date rolls over in the configured business timezone", () => {
  const instant = new Date("2026-08-16T18:30:00.000Z");
  assert.equal(getQueueDateKey(instant, "Asia/Dhaka"), "2026-08-17");
  assert.equal(getQueueDateKey(instant, "UTC"), "2026-08-16");
});
