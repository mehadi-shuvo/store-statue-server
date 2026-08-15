import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { GiftCardCodeStatus } from "../../../generated/prisma/client";
import { prismaC } from "../../../utils/prisma-client";
import { giftCardPurchaseService } from "../gift-card-purchase.service";

const run = process.env.RUN_GIFT_CARD_INTEGRATION_TESTS === "true";

test("two simultaneous purchases cannot receive the same inventory code", { skip: !run }, async () => {
  const marker = randomUUID();
  const user = await prismaC.user.create({
    data: {
      email: `gift-card-concurrency-${marker}@example.test`,
      name: "Gift Card Concurrency Test",
      password: "not-a-real-login-password",
    },
  });
  const product = await prismaC.giftCardProduct.create({
    data: {
      title: `Concurrency Card ${marker}`,
      slug: `concurrency-card-${marker}`,
      brand: "Test",
      image: "/test-only.png",
    },
  });
  const denomination = await prismaC.giftCardDenomination.create({
    data: {
      giftCardProductId: product.id,
      sellingPriceBDT: "100.00",
      cardValue: "1.00",
      cardCurrency: "USD",
    },
  });
  const inventory = await prismaC.giftCardCode.create({
    data: { denominationId: denomination.id, code: `TEST-ONLY-${marker}` },
  });

  try {
    const results = await Promise.allSettled([
      giftCardPurchaseService.createPurchase(user.id, [{ denominationId: denomination.id, quantity: 1 }], { useAccountEmail: true }),
      giftCardPurchaseService.createPurchase(user.id, [{ denominationId: denomination.id, quantity: 1 }], { useAccountEmail: true }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const sold = await prismaC.giftCardCode.findUniqueOrThrow({ where: { id: inventory.id } });
    assert.equal(sold.status, GiftCardCodeStatus.SOLD);
    assert.ok(sold.orderItemId);
    assert.equal(await prismaC.giftCardDelivery.count({ where: { inventoryCodeId: inventory.id } }), 1);
  } finally {
    const orders = await prismaC.order.findMany({ where: { userId: user.id }, select: { id: true } });
    const orderIds = orders.map((order) => order.id);
    await prismaC.giftCardDelivery.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
    await prismaC.giftCardCode.deleteMany({ where: { denominationId: denomination.id } });
    await prismaC.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prismaC.order.deleteMany({ where: { id: { in: orderIds } } });
    await prismaC.giftCardDenomination.delete({ where: { id: denomination.id } });
    await prismaC.giftCardProduct.delete({ where: { id: product.id } });
    await prismaC.cart.deleteMany({ where: { userId: user.id } });
    await prismaC.user.delete({ where: { id: user.id } });
  }
});
