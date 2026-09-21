import { mockPaymentProvider } from "../../payment/providers/mock-payment.provider";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { GiftCardCodeStatus, UserRole } from "../../../generated/prisma/client";
import { prismaC } from "../../../utils/prisma-client";
import { cartServices } from "../../cart/cart.service";
import { giftCardAdminService } from "../gift-card-admin.service";
import { giftCardOrderService } from "../gift-card-order.service";
import { giftCardPurchaseService } from "../gift-card-purchase.service";
import { giftCardServices } from "../gift-card.service";
import { paymentService } from "../../payment/services/payment-service.factory";
import { giftCardEmailSender } from "../gift-card-fulfillment.service";
import { ENV } from "../../../utils/env-config";

const run = process.env.RUN_GIFT_CARD_INTEGRATION_TESTS === "true";

test("admin, inventory, catalog, cart, purchase, and owned history workflow", { skip: !run }, async () => {
  const marker = randomUUID();
  const admin = await prismaC.user.create({
    data: { email: `gift-card-admin-${marker}@example.test`, name: "Gift Card Test Admin", password: "test-only", role: UserRole.ADMIN },
  });
  const customer = await prismaC.user.create({
    data: { email: `gift-card-customer-${marker}@example.test`, name: "Gift Card Test Customer", password: "test-only", isEmailVerified: true },
  });
  const otherCustomer = await prismaC.user.create({
    data: { email: `gift-card-other-${marker}@example.test`, name: "Other Customer", password: "test-only" },
  });
  let productId: string | undefined;
  let denominationId: string | undefined;
  const originalDeliver = giftCardEmailSender.send;
  const originalEncryptionKey = ENV.GIFT_CARD_ENCRYPTION_KEY;
  ENV.GIFT_CARD_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  const deliveries: unknown[] = [];
  giftCardEmailSender.send = async (...payload) => { deliveries.push(payload); };

  try {
    const product = await giftCardAdminService.createProduct(admin.id, {
      name: `Amazon Gift Card ${marker}`,
      slug: `amazon-gift-card-${marker}`,
      brand: "Amazon",
      imageUrl: "/images/amazon-test.png",
      currency: "USD",
    });
    productId = product.id;
    await giftCardAdminService.updateProduct(admin.id, product.id, { isActive: false });
    const hidden = await giftCardServices.getGiftCards({ search: marker });
    assert.equal(hidden.data.length, 0);
    await giftCardAdminService.updateProduct(admin.id, product.id, { isActive: true });

    const denomination = await giftCardAdminService.createDenomination(admin.id, product.id, {
      faceValue: "10.00",
      faceCurrency: "USD",
      sellingPriceBdt: "1280.00",
    });
    denominationId = denomination.id;
    await assert.rejects(() => giftCardAdminService.createDenomination(admin.id, product.id, {
      faceValue: "10.00", faceCurrency: "USD", sellingPriceBdt: "999.00",
    }));

    await giftCardAdminService.addCode(admin.id, denomination.id, { code: `TEST-${marker}-001` });
    await giftCardAdminService.addCodesBulk(admin.id, denomination.id, [
      { code: `TEST-${marker}-002`, pin: "1111" },
      { code: `TEST-${marker}-003` },
    ]);
    await giftCardAdminService.updateProduct(admin.id, product.id, { isActive: false });
    await assert.rejects(
      () => giftCardPurchaseService.instantBuy(customer.id, { denominationId: denomination.id, quantity: 1, useAccountEmail: true }),
      (error: any) => error.code === "GIFT_CARD_INACTIVE",
    );
    await giftCardAdminService.updateProduct(admin.id, product.id, { isActive: true });
    await assert.rejects(
      () => giftCardAdminService.addCode(admin.id, denomination.id, { code: `TEST-${marker}-001` }),
      (error: any) => error.code === "GIFT_CARD_CODE_ALREADY_EXISTS",
    );

    const catalog = await giftCardServices.getGiftCards({ search: marker });
    assert.equal(catalog.data.length, 1);
    assert.equal(catalog.data[0].denominations[0].inStock, true);
    assert.equal(JSON.stringify(catalog).includes(`TEST-${marker}`), false);

    const added = await cartServices.addGiftCardItem(customer.id, { denominationId: denomination.id, quantity: 1 });
    await cartServices.updateGiftCardItem(customer.id, added.id, 2);
    await cartServices.removeGiftCardItem(customer.id, added.id);
    await cartServices.addGiftCardItem(customer.id, { denominationId: denomination.id, quantity: 1 });

    const instantOrder = await giftCardPurchaseService.instantBuy(customer.id, {
      denominationId: denomination.id,
      quantity: 1,
      useAccountEmail: false,
      deliveryEmail: "Delivery@Example.Test",
    });
    assert.equal(instantOrder.totalBdt, "1280.00");
    assert.equal(instantOrder.deliveryEmail, customer.email);
    assert.equal(JSON.stringify(instantOrder).includes(`TEST-${marker}`), false);
    assert.equal((await prismaC.giftCardCode.count({ where: { denominationId: denomination.id, status: GiftCardCodeStatus.RESERVED } })), 1);
    const pendingDetail = await giftCardOrderService.getForCustomer(customer.id, instantOrder.id);
    assert.equal(pendingDetail.items[0].deliveries.length, 0);
    mockPaymentProvider.settle(instantOrder.paymentId);
    await paymentService.executePayment(instantOrder.paymentId, customer.id);
    const repeated = await paymentService.handleCallback(instantOrder.paymentId);
    assert.equal(repeated.outcome, "success");
    assert.equal(deliveries.length, 1, "duplicate callback must not send a second delivery");

    const cartOrder = await giftCardPurchaseService.checkoutCart(customer.id, { useAccountEmail: true });
    assert.equal(cartOrder.deliveryEmail, customer.email);
    mockPaymentProvider.settle(cartOrder.paymentId);
    await paymentService.executePayment(cartOrder.paymentId, customer.id);
    assert.equal((await cartServices.getCart(customer.id)).items.length, 0);
    assert.equal(deliveries.length, 2);

    const soldCodes = await prismaC.giftCardCode.findMany({ where: { denominationId: denomination.id, status: GiftCardCodeStatus.SOLD } });
    assert.equal(soldCodes.length, 2);
    assert.ok(soldCodes.every((code) => code.orderItemId));
    assert.equal(await prismaC.giftCardDelivery.count({ where: { inventoryCodeId: { in: soldCodes.map((code) => code.id) } } }), 2);

    await assert.rejects(
      () => giftCardPurchaseService.instantBuy(customer.id, { denominationId: denomination.id, quantity: 2, useAccountEmail: true }),
      (error: any) => error.code === "INSUFFICIENT_GIFT_CARD_STOCK",
    );
    await giftCardAdminService.updateDenomination(admin.id, denomination.id, { isActive: false });
    await assert.rejects(
      () => giftCardPurchaseService.instantBuy(customer.id, { denominationId: denomination.id, quantity: 1, useAccountEmail: true }),
      (error: any) => error.code === "GIFT_CARD_DENOMINATION_INACTIVE",
    );

    const history = await giftCardOrderService.listForCustomer(customer.id, { page: 1, limit: 20 });
    assert.equal(history.data.length, 2);
    const detail = await giftCardOrderService.getForCustomer(customer.id, instantOrder.id);
    assert.equal(detail.items[0].deliveries.length, 1);
    assert.ok(detail.items[0].deliveries[0].code.startsWith("TEST-"));
    await assert.rejects(
      () => giftCardOrderService.getForCustomer(otherCustomer.id, instantOrder.id),
      (error: any) => error.code === "ORDER_NOT_FOUND",
    );
    const delivery = await giftCardOrderService.getDeliveryForCustomer(customer.id, instantOrder.id);
    assert.equal(delivery.products[0].delivery.length, 1);
    await assert.rejects(
      () => giftCardOrderService.getDeliveryForCustomer(otherCustomer.id, instantOrder.id),
      (error: any) => error.code === "DELIVERY_NOT_FOUND",
    );
    const adminOrders = await giftCardOrderService.listForAdmin({ page: 1, limit: 20, email: customer.email });
    assert.equal(adminOrders.data.length, 2);
    assert.equal((await giftCardOrderService.getForAdmin(instantOrder.id)).id, instantOrder.id);
  } finally {
    giftCardEmailSender.send = originalDeliver;
    ENV.GIFT_CARD_ENCRYPTION_KEY = originalEncryptionKey;
    const orders = await prismaC.order.findMany({ where: { userId: customer.id }, select: { id: true } });
    const orderIds = orders.map((order) => order.id);
    await prismaC.giftCardDelivery.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
    await prismaC.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    if (denominationId) await prismaC.giftCardCode.deleteMany({ where: { denominationId } });
    await prismaC.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prismaC.order.deleteMany({ where: { id: { in: orderIds } } });
    await prismaC.cartItem.deleteMany({ where: { cart: { userId: customer.id } } });
    await prismaC.cart.deleteMany({ where: { userId: customer.id } });
    if (denominationId) await prismaC.giftCardDenomination.deleteMany({ where: { id: denominationId } });
    if (productId) await prismaC.giftCardProduct.deleteMany({ where: { id: productId } });
    await prismaC.auditLog.deleteMany({ where: { actorId: admin.id } });
    await prismaC.user.deleteMany({ where: { id: { in: [admin.id, customer.id, otherCustomer.id] } } });
  }
});
