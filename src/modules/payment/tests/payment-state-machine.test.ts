import assert from "node:assert/strict";
import test from "node:test";
import { PaymentStatus } from "../../../generated/prisma/client";
import { assertPaymentTransition, paymentNeedsReconciliation } from "../services/payment-state-machine";

test("payment state machine allows reconciliation and rejects unsafe terminal revival", () => {
  assert.doesNotThrow(() => assertPaymentTransition(PaymentStatus.PROCESSING, PaymentStatus.UNKNOWN));
  assert.doesNotThrow(() => assertPaymentTransition(PaymentStatus.UNKNOWN, PaymentStatus.PAID));
  assert.throws(() => assertPaymentTransition(PaymentStatus.REFUNDED, PaymentStatus.PAID));
  assert.throws(() => assertPaymentTransition(PaymentStatus.CANCELLED, PaymentStatus.PAID));
  assert.doesNotThrow(() => assertPaymentTransition(PaymentStatus.CANCELLED, PaymentStatus.PAID, { lateVerifiedRecovery: true }));
  assert.equal(paymentNeedsReconciliation(PaymentStatus.UNKNOWN), true);
  assert.equal(paymentNeedsReconciliation(PaymentStatus.REFUND_PENDING), false);
});
