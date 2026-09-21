import { mockPaymentProvider } from "../../payment/providers/mock-payment.provider";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { GiftCardCodeStatus, PaymentMethod, PaymentStatus } from "../../../generated/prisma/client";
import { prismaC } from "../../../utils/prisma-client";
import { giftCardPurchaseService } from "../../gift-card/gift-card-purchase.service";
import { paymentService } from "../services/payment-service.factory";

const run = process.env.RUN_GIFT_CARD_INTEGRATION_TESTS === "true";

for (const scenario of ["failure", "cancel"] as const) {
  test(`${scenario} payment releases reserved gift-card inventory`, { skip: !run }, async () => {
    const marker = randomUUID();
    const user = await prismaC.user.create({
      data: { email: `payment-${scenario}-${marker}@example.test`, name: "Payment Test", password: "test", isEmailVerified: true },
    });
    const product = await prismaC.giftCardProduct.create({
      data: { title: `Payment ${scenario} ${marker}`, slug: `payment-${scenario}-${marker}`, brand: "Test", image: "/test.png" },
    });
    const denomination = await prismaC.giftCardDenomination.create({
      data: { giftCardProductId: product.id, sellingPriceBDT: "5000.00", cardValue: "5.00", cardCurrency: "USD" },
    });
    const code = await prismaC.giftCardCode.create({
      data: { denominationId: denomination.id, code: `LEGACY-${marker}` },
    });
    try {
      const checkout = await giftCardPurchaseService.createPurchase(
        user.id,
        [{ denominationId: denomination.id, quantity: 1 }],
        { useAccountEmail: true },
      );
      assert.equal((await prismaC.giftCardCode.findUniqueOrThrow({ where: { id: code.id } })).status, GiftCardCodeStatus.RESERVED);
      mockPaymentProvider.settle(checkout.paymentId, scenario === "cancel" ? "CANCELLED" : "FAILED");
      const result = await paymentService.executePayment(checkout.paymentId, user.id);
      assert.equal(result.status, scenario === "cancel" ? PaymentStatus.CANCELLED : PaymentStatus.FAILED);
      const released = await prismaC.giftCardCode.findUniqueOrThrow({ where: { id: code.id } });
      assert.equal(released.status, GiftCardCodeStatus.AVAILABLE);
      assert.equal(released.orderItemId, null);
      assert.equal(await prismaC.giftCardDelivery.count({ where: { inventoryCodeId: code.id } }), 0);
    } finally {
      const orders = await prismaC.order.findMany({ where: { userId: user.id }, select: { id: true } });
      const orderIds = orders.map((order) => order.id);
      await prismaC.giftCardDelivery.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
      await prismaC.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prismaC.giftCardCode.deleteMany({ where: { denominationId: denomination.id } });
      await prismaC.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prismaC.order.deleteMany({ where: { id: { in: orderIds } } });
      await prismaC.giftCardDenomination.delete({ where: { id: denomination.id } });
      await prismaC.giftCardProduct.delete({ where: { id: product.id } });
      await prismaC.user.delete({ where: { id: user.id } });
    }
  });
}

test("database rejects a transaction id already assigned to another payment", { skip: !run }, async () => {
  const marker = randomUUID();
  const user = await prismaC.user.create({ data: { email: `duplicate-trx-${marker}@example.test`, name: "Duplicate Test", password: "test" } });
  const makeOrder = (suffix: string) => prismaC.order.create({
    data: { orderNumber: `DUP-${marker}-${suffix}`, userId: user.id, subtotal: "1", totalCost: "1" },
  });
  const first = await makeOrder("A");
  const second = await makeOrder("B");
  try {
    await prismaC.payment.create({
      data: { orderId: first.id, paymentMethod: PaymentMethod.AAMARPAY, paymentStatus: PaymentStatus.PAID, amount: "1", transactionId: `TRX-${marker}` },
    });
    await assert.rejects(() => prismaC.payment.create({
      data: { orderId: second.id, paymentMethod: PaymentMethod.AAMARPAY, paymentStatus: PaymentStatus.PAID, amount: "1", transactionId: `TRX-${marker}` },
    }));
  } finally {
    await prismaC.payment.deleteMany({ where: { orderId: { in: [first.id, second.id] } } });
    await prismaC.order.deleteMany({ where: { id: { in: [first.id, second.id] } } });
    await prismaC.user.delete({ where: { id: user.id } });
  }
});
