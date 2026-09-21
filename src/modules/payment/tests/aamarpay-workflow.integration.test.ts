import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { type TestContext } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { once } from "node:events";
import { GiftCardCodeStatus, PaymentStatus } from "../../../generated/prisma/client";
import { prismaC } from "../../../utils/prisma-client";
import { ENV } from "../../../utils/env-config";
import { ApiAppError } from "../../../utils/apiAppError";
import { applyHttpSecurity } from "../../../middlewares/security.middleware";
import { globalErrorHandler } from "../../../middlewares/globalErrorHandler";
import { giftCardPurchaseService } from "../../gift-card/gift-card-purchase.service";
import { giftCardEmailSender } from "../../gift-card/gift-card-fulfillment.service";
import { paymentService } from "../services/payment-service.factory";
import { PaymentService } from "../services/payment.service";
import { mockPaymentProvider } from "../providers/mock-payment.provider";
import { PaymentProviderError } from "../utils/payment-provider-error";
import { paymentRouter } from "../routes/payment.route";

const run = process.env.RUN_GIFT_CARD_INTEGRATION_TESTS === "true";
const options = { skip: !run };
async function fixture(t: TestContext) {
  const marker = randomUUID();
  const user = await prismaC.user.create({ data: { email: `aamarpay-${marker}@example.test`, name: "Payment Test", password: "test-only", isEmailVerified: true } });
  const product = await prismaC.giftCardProduct.create({ data: { title: `Payment ${marker}`, slug: `payment-${marker}`, brand: "Test", image: "/test.png" } });
  const denomination = await prismaC.giftCardDenomination.create({ data: { giftCardProductId: product.id, sellingPriceBDT: "500.00", cardValue: "5.00", cardCurrency: "USD" } });
  await prismaC.giftCardCode.createMany({ data: Array.from({ length: 5 }, (_, i) => ({ denominationId: denomination.id, code: `TEST-${marker}-${i}` })) });
  let emails = 0;
  t.mock.method(giftCardEmailSender, "send", async () => { emails++; });
  t.after(async () => {
    const orders = await prismaC.order.findMany({ where: { userId: user.id }, select: { id: true, payment: { select: { id: true } } } });
    const ids = orders.map(order => order.id);
    await prismaC.auditLog.deleteMany({ where: { OR: [{ actorId: user.id }, { entityId: { in: [...ids, ...orders.flatMap(order => order.payment ? [order.payment.id] : [])] } }] } });
    await prismaC.giftCardDelivery.deleteMany({ where: { orderItem: { orderId: { in: ids } } } });
    await prismaC.payment.deleteMany({ where: { orderId: { in: ids } } });
    await prismaC.giftCardCode.deleteMany({ where: { denominationId: denomination.id } });
    await prismaC.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prismaC.order.deleteMany({ where: { id: { in: ids } } });
    await prismaC.giftCardDenomination.delete({ where: { id: denomination.id } });
    await prismaC.giftCardProduct.delete({ where: { id: product.id } });
    await prismaC.user.delete({ where: { id: user.id } });
  });
  return {
    user, denomination, emails: () => emails,
    buy: (key?: string) => giftCardPurchaseService.createPurchase(user.id, [{ denominationId: denomination.id, quantity: 1 }], { useAccountEmail: true }, [], key),
  };
}

test("initialization rejects missing orders and wrong ownership, and reuses the same checkout", options, async t => {
  const f = await fixture(t);
  await assert.rejects(() => paymentService.createPayment({ orderId: randomUUID() }, f.user.id), (e: unknown) => e instanceof ApiAppError && e.statusCode === 404);
  const checkout = await f.buy("repeat-key");
  await assert.rejects(() => paymentService.createPayment({ orderId: checkout.orderId }, randomUUID()), (e: unknown) => e instanceof ApiAppError && e.statusCode === 404);
  const repeated = await f.buy("repeat-key");
  assert.equal(repeated.orderId, checkout.orderId); assert.equal(repeated.transactionId, checkout.transactionId);
  assert.equal(repeated.paymentExpiresAt.getTime(), checkout.paymentExpiresAt.getTime());
  const again = await paymentService.createPayment({ orderId: checkout.orderId }, f.user.id);
  assert.equal(again.paymentUrl, checkout.paymentUrl);
  assert.equal(await prismaC.payment.count({ where: { orderId: checkout.orderId } }), 1);
  assert.equal(await prismaC.paymentAttempt.count({ where: { orderId: checkout.orderId } }), 1);
  assert.equal(await prismaC.giftCardCode.count({ where: { denominationId: f.denomination.id, status: "RESERVED" } }), 1);
  const reservedCode = await prismaC.giftCardCode.findFirstOrThrow({
    where: { denominationId: f.denomination.id, status: "RESERVED" },
  });
  assert.equal(
    reservedCode.reservationExpiresAt!.getTime() - reservedCode.reservedAt!.getTime(),
    5 * 60_000,
  );
});

test("concurrent initiation contacts the gateway once after persisting the transaction", options, async t => {
  const f = await fixture(t);
  const order = await prismaC.order.create({ data: { orderNumber: `CONCURRENT-${randomUUID()}`, userId: f.user.id, subtotal: "10", totalCost: "10", items: { create: { productType: "GIFT_CARD", quantity: 1, unitPrice: "10", totalPrice: "10", productTitle: "Test" } } } });
  let calls = 0;
  const service = new PaymentService({ name: "mock", queryPayment: mockPaymentProvider.queryPayment.bind(mockPaymentProvider), createPayment: async input => {
    calls++;
    assert.ok(await prismaC.payment.findUnique({ where: { paymentId: input.transactionId } }));
    await new Promise(resolve => setTimeout(resolve, 50));
    return mockPaymentProvider.createPayment(input);
  } });
  const results = await Promise.allSettled([service.createPayment({ orderId: order.id }, f.user.id), service.createPayment({ orderId: order.id }, f.user.id)]);
  assert.equal(calls, 1); assert.ok(results.some(result => result.status === "fulfilled"));
  assert.equal(await prismaC.payment.count({ where: { orderId: order.id } }), 1);
});

test("callbacks query the gateway and concurrent duplicate success fulfills and emails once", options, async t => {
  const f = await fixture(t);
  const checkout = await f.buy();
  const query = t.mock.method(mockPaymentProvider, "queryPayment");
  assert.equal((await paymentService.handleCallback(checkout.transactionId)).outcome, "processing");
  assert.equal(query.mock.callCount(), 1);
  assert.equal(await prismaC.giftCardDelivery.count({ where: { orderItem: { orderId: checkout.orderId } } }), 0);
  mockPaymentProvider.settle(checkout.transactionId);
  const callbacks = await Promise.all([paymentService.handleCallback(checkout.transactionId), paymentService.handleCallback(checkout.transactionId)]);
  assert.ok(callbacks.every(result => result.outcome === "success"));
  assert.equal(f.emails(), 1);
  assert.equal(await prismaC.giftCardDelivery.count({ where: { orderItem: { orderId: checkout.orderId } } }), 1);
  assert.equal(await prismaC.giftCardCode.count({ where: { denominationId: f.denomination.id, status: "SOLD" } }), 1);
  assert.equal((await paymentService.handleCallback(checkout.transactionId)).outcome, "success");
  assert.equal(f.emails(), 1);
});

for (const patch of [{ amount: "1.00" }, { paymentId: "OTHER" }, { currency: "USD" }, { transactionId: null }]) test(`verification rejects ${Object.keys(patch)[0]} mismatch without fulfillment`, options, async t => {
  const f = await fixture(t); const checkout = await f.buy();
  mockPaymentProvider.settle(checkout.transactionId);
  const original = await mockPaymentProvider.queryPayment({ paymentId: checkout.transactionId });
  t.mock.method(mockPaymentProvider, "queryPayment", async () => ({ ...original, ...patch }));
  assert.equal((await paymentService.handleCallback(checkout.transactionId)).outcome, "processing");
  assert.equal((await prismaC.payment.findUniqueOrThrow({ where: { orderId: checkout.orderId } })).paymentStatus, PaymentStatus.PROCESSING);
  assert.equal(await prismaC.giftCardDelivery.count({ where: { orderItem: { orderId: checkout.orderId } } }), 0);
  assert.equal(f.emails(), 0);
});

for (const status of ["FAILED", "CANCELLED"] as const) test(`verified ${status} releases inventory and a later paid callback safely reallocates it`, options, async t => {
  const f = await fixture(t); const checkout = await f.buy();
  mockPaymentProvider.settle(checkout.transactionId, status);
  assert.equal((await paymentService.handleCallback(checkout.transactionId)).outcome, status === "FAILED" ? "failed" : "cancelled");
  assert.equal(await prismaC.giftCardCode.count({ where: { denominationId: f.denomination.id, status: GiftCardCodeStatus.RESERVED } }), 0);
  mockPaymentProvider.settle(checkout.transactionId, "PAID");
  await paymentService.handleCallback(checkout.transactionId);
  assert.equal((await prismaC.payment.findUniqueOrThrow({ where: { orderId: checkout.orderId } })).paymentStatus, PaymentStatus.PAID);
  assert.equal(f.emails(), 1);
});

test("refunded payment is never fulfilled by callback", options, async t => {
  const f = await fixture(t); const checkout = await f.buy();
  await prismaC.payment.update({ where: { orderId: checkout.orderId }, data: { paymentStatus: "REFUNDED" } });
  mockPaymentProvider.settle(checkout.transactionId);
  assert.equal((await paymentService.handleCallback(checkout.transactionId)).outcome, "failed");
  assert.equal(f.emails(), 0);
});

test("one gateway transaction cannot fulfill two orders", options, async t => {
  const f = await fixture(t);
  const first = await f.buy();
  const second = await f.buy();
  mockPaymentProvider.settle(first.transactionId);
  assert.equal((await paymentService.handleCallback(first.transactionId)).outcome, "success");
  const firstState = await mockPaymentProvider.queryPayment({ paymentId: first.transactionId });
  const secondState = await mockPaymentProvider.queryPayment({ paymentId: second.transactionId });
  t.mock.method(mockPaymentProvider, "queryPayment", async () => ({ ...secondState, status: "PAID" as const, transactionId: firstState.transactionId }));
  assert.equal((await paymentService.handleCallback(second.transactionId)).outcome, "processing");
  assert.equal((await prismaC.payment.findUniqueOrThrow({ where: { orderId: second.orderId } })).paymentStatus, "PROCESSING");
  assert.equal(await prismaC.giftCardDelivery.count({ where: { orderItem: { orderId: second.orderId } } }), 0);
  assert.equal(f.emails(), 1);
});

test("an expired pending payment is durably reconciled after the gateway later confirms it", options, async t => {
  const f = await fixture(t);
  const checkout = await f.buy();
  await prismaC.giftCardCode.updateMany({ where: { orderItem: { orderId: checkout.orderId } }, data: { reservationExpiresAt: new Date(0) } });
  await paymentService.reconcileExpiredGiftCardReservations();
  assert.equal(await prismaC.giftCardCode.count({ where: { denominationId: f.denomination.id, status: "RESERVED" } }), 1);
  assert.equal((await prismaC.payment.findUniqueOrThrow({ where: { orderId: checkout.orderId } })).paymentStatus, "UNKNOWN");
  mockPaymentProvider.settle(checkout.transactionId, "PAID");
  await paymentService.reconcileUnknownPayments();
  assert.equal((await prismaC.payment.findUniqueOrThrow({ where: { orderId: checkout.orderId } })).paymentStatus, "PAID");
  assert.equal(await prismaC.giftCardCode.count({ where: { denominationId: f.denomination.id, status: "SOLD" } }), 1);
});

test("late paid callback enters REFUND_PENDING when equivalent inventory is unavailable", options, async t => {
  const f = await fixture(t); const checkout = await f.buy();
  mockPaymentProvider.settle(checkout.transactionId, "FAILED");
  await paymentService.handleCallback(checkout.transactionId);
  await prismaC.giftCardCode.updateMany({ where: { denominationId: f.denomination.id, status: GiftCardCodeStatus.AVAILABLE }, data: { status: GiftCardCodeStatus.SOLD } });
  mockPaymentProvider.settle(checkout.transactionId, "PAID");
  assert.equal((await paymentService.handleCallback(checkout.transactionId)).outcome, "processing");
  const payment = await prismaC.payment.findUniqueOrThrow({ where: { orderId: checkout.orderId } });
  assert.equal(payment.paymentStatus, PaymentStatus.REFUND_PENDING);
  assert.equal(f.emails(), 0);
});

test("an expired reservation is fulfilled when the gateway already confirms payment", options, async t => {
  const f = await fixture(t);
  const checkout = await f.buy();
  await prismaC.giftCardCode.updateMany({ where: { orderItem: { orderId: checkout.orderId } }, data: { reservationExpiresAt: new Date(0) } });
  mockPaymentProvider.settle(checkout.transactionId, "PAID");
  await paymentService.reconcileExpiredGiftCardReservations();
  assert.equal(await prismaC.giftCardCode.count({ where: { denominationId: f.denomination.id, status: "SOLD" } }), 1);
  assert.equal((await prismaC.payment.findUniqueOrThrow({ where: { orderId: checkout.orderId } })).paymentStatus, "PAID");
});

test("unknown transaction and gateway timeout cannot fulfill or release inventory", options, async t => {
  const f = await fixture(t); const checkout = await f.buy();
  assert.equal((await paymentService.handleCallback("GX_unknown")).outcome, "failed");
  t.mock.method(mockPaymentProvider, "queryPayment", async () => { throw new PaymentProviderError("timeout", "mock"); });
  assert.equal((await paymentService.handleCallback(checkout.transactionId)).outcome, "processing");
  assert.equal(await prismaC.giftCardCode.count({ where: { denominationId: f.denomination.id, status: "RESERVED" } }), 1);
});

for (const rejected of [true, false]) test(`initiation ${rejected ? "rejection releases" : "timeout retains"} the reservation`, options, async t => {
  const f = await fixture(t);
  t.mock.method(mockPaymentProvider, "createPayment", async () => { throw new PaymentProviderError("initiation failure", "mock", { rejected }); });
  await assert.rejects(() => f.buy(), (e: unknown) => e instanceof ApiAppError && e.statusCode === 502);
  assert.equal(await prismaC.giftCardCode.count({ where: { denominationId: f.denomination.id, status: "RESERVED" } }), rejected ? 0 : 1);
});

test("HTTP routes enforce auth, accept gateway forms without CORS/JWT, and never trust success/fail/cancel bodies", options, async t => {
  const f = await fixture(t); const checkout = await f.buy();
  const app = express(); applyHttpSecurity(app); app.use(express.json()); app.use(express.urlencoded({ extended: false }));
  app.use("/api/v1/payments", paymentRouter); app.use(globalErrorHandler);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/v1/payments`;
  assert.equal((await fetch(`${base}/initiate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: checkout.orderId }) })).status, 401);
  const token = jwt.sign({ userId: f.user.id }, ENV.JWT_SECRET);
  assert.equal((await fetch(`${base}/initiate`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ orderId: checkout.orderId, amount: 1 }) })).status, 400);
  assert.equal((await fetch(`${base}/aamarpay/success?transactionId=${checkout.transactionId}`, { redirect: "manual" })).status, 404);
  for (const path of ["success", "fail", "cancel"]) {
    const response = await fetch(`${base}/aamarpay/${path}`, { method: "POST", headers: { Origin: "https://sandbox.aamarpay.com", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ mer_txnid: checkout.transactionId, pay_status: "Successful", amount: "500.00" }), redirect: "manual" });
    assert.equal(response.status, 303);
    assert.ok(response.headers.get("location")?.includes("/payment/processing?orderId="));
  }
  const cancelled = await fetch(`${base}/aamarpay/cancel?transactionId=${checkout.transactionId}`, { redirect: "manual" });
  assert.equal(cancelled.status, 303);
  const mismatch = await fetch(`${base}/aamarpay/success?transactionId=OTHER`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mer_txnid: checkout.transactionId }), redirect: "manual" });
  assert.equal(mismatch.status, 400);
  assert.equal(f.emails(), 0);
  mockPaymentProvider.settle(checkout.transactionId);
  const verified = await fetch(`${base}/aamarpay/success`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mer_txnid: checkout.transactionId, amount: "1" }), redirect: "manual" });
  assert.equal(verified.status, 303); assert.ok(verified.headers.get("location")?.includes("/payment/success?orderId="));
  assert.equal(f.emails(), 1);
});
