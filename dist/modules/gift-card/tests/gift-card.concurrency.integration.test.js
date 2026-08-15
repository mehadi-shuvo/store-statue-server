"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const node_test_1 = __importDefault(require("node:test"));
const client_1 = require("../../../generated/prisma/client");
const prisma_client_1 = require("../../../utils/prisma-client");
const gift_card_purchase_service_1 = require("../gift-card-purchase.service");
const run = process.env.RUN_GIFT_CARD_INTEGRATION_TESTS === "true";
(0, node_test_1.default)("two simultaneous purchases cannot receive the same inventory code", { skip: !run }, async () => {
    const marker = (0, node_crypto_1.randomUUID)();
    const user = await prisma_client_1.prismaC.user.create({
        data: {
            email: `gift-card-concurrency-${marker}@example.test`,
            name: "Gift Card Concurrency Test",
            password: "not-a-real-login-password",
        },
    });
    const product = await prisma_client_1.prismaC.giftCardProduct.create({
        data: {
            title: `Concurrency Card ${marker}`,
            slug: `concurrency-card-${marker}`,
            brand: "Test",
            image: "/test-only.png",
        },
    });
    const denomination = await prisma_client_1.prismaC.giftCardDenomination.create({
        data: {
            giftCardProductId: product.id,
            sellingPriceBDT: "100.00",
            cardValue: "1.00",
            cardCurrency: "USD",
        },
    });
    const inventory = await prisma_client_1.prismaC.giftCardCode.create({
        data: { denominationId: denomination.id, code: `TEST-ONLY-${marker}` },
    });
    try {
        const results = await Promise.allSettled([
            gift_card_purchase_service_1.giftCardPurchaseService.createPurchase(user.id, [{ denominationId: denomination.id, quantity: 1 }], { useAccountEmail: true }),
            gift_card_purchase_service_1.giftCardPurchaseService.createPurchase(user.id, [{ denominationId: denomination.id, quantity: 1 }], { useAccountEmail: true }),
        ]);
        strict_1.default.equal(results.filter((result) => result.status === "fulfilled").length, 1);
        strict_1.default.equal(results.filter((result) => result.status === "rejected").length, 1);
        const sold = await prisma_client_1.prismaC.giftCardCode.findUniqueOrThrow({ where: { id: inventory.id } });
        strict_1.default.equal(sold.status, client_1.GiftCardCodeStatus.SOLD);
        strict_1.default.ok(sold.orderItemId);
        strict_1.default.equal(await prisma_client_1.prismaC.giftCardDelivery.count({ where: { inventoryCodeId: inventory.id } }), 1);
    }
    finally {
        const orders = await prisma_client_1.prismaC.order.findMany({ where: { userId: user.id }, select: { id: true } });
        const orderIds = orders.map((order) => order.id);
        await prisma_client_1.prismaC.giftCardDelivery.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
        await prisma_client_1.prismaC.giftCardCode.deleteMany({ where: { denominationId: denomination.id } });
        await prisma_client_1.prismaC.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma_client_1.prismaC.order.deleteMany({ where: { id: { in: orderIds } } });
        await prisma_client_1.prismaC.giftCardDenomination.delete({ where: { id: denomination.id } });
        await prisma_client_1.prismaC.giftCardProduct.delete({ where: { id: product.id } });
        await prisma_client_1.prismaC.cart.deleteMany({ where: { userId: user.id } });
        await prisma_client_1.prismaC.user.delete({ where: { id: user.id } });
    }
});
