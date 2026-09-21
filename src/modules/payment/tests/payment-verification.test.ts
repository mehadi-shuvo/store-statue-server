import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "../../../generated/prisma/client";
import { buyNowSchema } from "../../gift-card/gift-card.validation";
import { ApiAppError } from "../../../utils/apiAppError";
import { assertVerifiedPayment } from "../utils/payment-verification";
import { createTransactionId } from "../utils/payment.utils";
import { aamarpayCallbackSchema, aamarpayCallbackQuerySchema, createPaymentSchema } from "../validators/payment.validation";

const internal = { paymentId: "GX_TEST1", amount: new Prisma.Decimal("5000.00"), currency: "BDT", merchantInvoiceNumber: "GX_TEST1" };
const verified = { paymentId: "GX_TEST1", transactionId: "AAM_GATEWAY1", amount: "5000.00", currency: "BDT", status: "PAID" as const, raw: {} };
test("verified payment returns the gateway transaction id", () => assert.equal(assertVerifiedPayment(verified, internal), "AAM_GATEWAY1"));
for (const [name, patch, code] of [
  ["amount mismatch", { amount: "4999.99" }, "PAYMENT_AMOUNT_MISMATCH"],
  ["fractional cents", { amount: "5000.001" }, "PAYMENT_AMOUNT_MISMATCH"],
  ["invalid amount", { amount: "NaN" }, "PAYMENT_AMOUNT_MISMATCH"],
  ["currency mismatch", { currency: "USD" }, "PAYMENT_CURRENCY_MISMATCH"],
  ["merchant currency mismatch", { merchantCurrency: "USD" }, "PAYMENT_CURRENCY_MISMATCH"],
  ["transaction mismatch", { paymentId: "OTHER" }, "PAYMENT_ID_MISMATCH"],
  ["missing gateway id", { transactionId: null }, "PAYMENT_TRX_ID_MISSING"],
  ["pending status", { status: "PENDING" as const }, "PAYMENT_NOT_COMPLETED"],
] as const) test(`${name} cannot verify`, () => {
  assert.throws(() => assertVerifiedPayment({ ...verified, ...patch }, internal), (error: unknown) => error instanceof ApiAppError && error.code === code);
});
test("currency is checked when supplied; an absent optional currency is accepted", () => assert.equal(assertVerifiedPayment({ ...verified, currency: undefined }, internal), "AAM_GATEWAY1"));
test("transaction identifiers are server-generated and within the gateway length limit", () => {
  const ids = Array.from({ length: 1000 }, createTransactionId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => /^GX_[a-f0-9]{28}$/.test(id) && id.length <= 32));
});
test("checkout and initialization reject frontend amount and transaction IDs", () => {
  const id = "10000000-0000-4000-8000-000000000001";
  assert.equal(buyNowSchema.safeParse({ productId: id }).success, true);
  assert.equal(buyNowSchema.safeParse({ productId: id, amount: 1 }).success, false);
  assert.equal(createPaymentSchema.safeParse({ orderId: id, amount: 1 }).success, false);
  assert.equal(createPaymentSchema.safeParse({ orderId: id, transactionId: "attacker" }).success, false);
});
test("callback sanitization only retains a bounded merchant transaction identifier", () => {
  assert.deepEqual(aamarpayCallbackSchema.parse({ mer_txnid: "GX_123", pay_status: "Successful", amount: "1", signature_key: "untrusted" }), { mer_txnid: "GX_123" });
  assert.equal(aamarpayCallbackSchema.safeParse({ mer_txnid: ["GX_1", "GX_2"] }).success, false);
  assert.equal(aamarpayCallbackSchema.safeParse({ mer_txnid: "x".repeat(33) }).success, false);
  assert.equal(aamarpayCallbackQuerySchema.safeParse({ transactionId: "../invalid" }).success, false);
});
