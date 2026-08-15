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
const cart_service_1 = require("../../cart/cart.service");
const gift_card_admin_service_1 = require("../gift-card-admin.service");
const gift_card_order_service_1 = require("../gift-card-order.service");
const gift_card_purchase_service_1 = require("../gift-card-purchase.service");
const gift_card_service_1 = require("../gift-card.service");
const console_digital_delivery_provider_1 = require("../providers/console-digital-delivery.provider");
const run = process.env.RUN_GIFT_CARD_INTEGRATION_TESTS === "true";
(0, node_test_1.default)("admin, inventory, catalog, cart, purchase, and owned history workflow", { skip: !run }, async () => {
    const marker = (0, node_crypto_1.randomUUID)();
    const admin = await prisma_client_1.prismaC.user.create({
        data: { email: `gift-card-admin-${marker}@example.test`, name: "Gift Card Test Admin", password: "test-only", role: client_1.UserRole.ADMIN },
    });
    const customer = await prisma_client_1.prismaC.user.create({
        data: { email: `gift-card-customer-${marker}@example.test`, name: "Gift Card Test Customer", password: "test-only" },
    });
    const otherCustomer = await prisma_client_1.prismaC.user.create({
        data: { email: `gift-card-other-${marker}@example.test`, name: "Other Customer", password: "test-only" },
    });
    let productId;
    let denominationId;
    const originalDeliver = console_digital_delivery_provider_1.digitalDeliveryProvider.deliver;
    const deliveries = [];
    console_digital_delivery_provider_1.digitalDeliveryProvider.deliver = async (payload) => { deliveries.push(payload); };
    try {
        const product = await gift_card_admin_service_1.giftCardAdminService.createProduct(admin.id, {
            name: `Amazon Gift Card ${marker}`,
            slug: `amazon-gift-card-${marker}`,
            brand: "Amazon",
            imageUrl: "/images/amazon-test.png",
            currency: "USD",
        });
        productId = product.id;
        await gift_card_admin_service_1.giftCardAdminService.updateProduct(admin.id, product.id, { isActive: false });
        const hidden = await gift_card_service_1.giftCardServices.getGiftCards({ search: marker });
        strict_1.default.equal(hidden.data.length, 0);
        await gift_card_admin_service_1.giftCardAdminService.updateProduct(admin.id, product.id, { isActive: true });
        const denomination = await gift_card_admin_service_1.giftCardAdminService.createDenomination(admin.id, product.id, {
            faceValue: "10.00",
            faceCurrency: "USD",
            sellingPriceBdt: "1280.00",
        });
        denominationId = denomination.id;
        await strict_1.default.rejects(() => gift_card_admin_service_1.giftCardAdminService.createDenomination(admin.id, product.id, {
            faceValue: "10.00", faceCurrency: "USD", sellingPriceBdt: "999.00",
        }));
        await gift_card_admin_service_1.giftCardAdminService.addCode(admin.id, denomination.id, { code: `TEST-${marker}-001` });
        await gift_card_admin_service_1.giftCardAdminService.addCodesBulk(admin.id, denomination.id, [
            { code: `TEST-${marker}-002`, pin: "1111" },
            { code: `TEST-${marker}-003` },
        ]);
        await strict_1.default.rejects(() => gift_card_admin_service_1.giftCardAdminService.addCode(admin.id, denomination.id, { code: `TEST-${marker}-001` }), (error) => error.code === "GIFT_CARD_CODE_ALREADY_EXISTS");
        const catalog = await gift_card_service_1.giftCardServices.getGiftCards({ search: marker });
        strict_1.default.equal(catalog.data.length, 1);
        strict_1.default.equal(catalog.data[0].denominations[0].inStock, true);
        strict_1.default.equal(JSON.stringify(catalog).includes(`TEST-${marker}`), false);
        const added = await cart_service_1.cartServices.addGiftCardItem(customer.id, { denominationId: denomination.id, quantity: 1 });
        await cart_service_1.cartServices.updateGiftCardItem(customer.id, added.id, 2);
        await cart_service_1.cartServices.removeGiftCardItem(customer.id, added.id);
        await cart_service_1.cartServices.addGiftCardItem(customer.id, { denominationId: denomination.id, quantity: 1 });
        await strict_1.default.rejects(() => gift_card_purchase_service_1.giftCardPurchaseService.instantBuy(customer.id, { denominationId: denomination.id, quantity: 1, useAccountEmail: false }), (error) => error.code === "DELIVERY_EMAIL_REQUIRED");
        const instantOrder = await gift_card_purchase_service_1.giftCardPurchaseService.instantBuy(customer.id, {
            denominationId: denomination.id,
            quantity: 1,
            useAccountEmail: false,
            deliveryEmail: "Delivery@Example.Test",
        });
        strict_1.default.equal(instantOrder.totalBdt, "1280.00");
        strict_1.default.equal(instantOrder.deliveryEmail, "delivery@example.test");
        const cartOrder = await gift_card_purchase_service_1.giftCardPurchaseService.checkoutCart(customer.id, { useAccountEmail: true });
        strict_1.default.equal(cartOrder.deliveryEmail, customer.email);
        strict_1.default.equal((await cart_service_1.cartServices.getCart(customer.id)).items.length, 0);
        strict_1.default.equal(deliveries.length, 2);
        const soldCodes = await prisma_client_1.prismaC.giftCardCode.findMany({ where: { denominationId: denomination.id, status: client_1.GiftCardCodeStatus.SOLD } });
        strict_1.default.equal(soldCodes.length, 2);
        strict_1.default.ok(soldCodes.every((code) => code.orderItemId));
        strict_1.default.equal(await prisma_client_1.prismaC.giftCardDelivery.count({ where: { inventoryCodeId: { in: soldCodes.map((code) => code.id) } } }), 2);
        await strict_1.default.rejects(() => gift_card_purchase_service_1.giftCardPurchaseService.instantBuy(customer.id, { denominationId: denomination.id, quantity: 2, useAccountEmail: true }), (error) => error.code === "INSUFFICIENT_GIFT_CARD_STOCK");
        await gift_card_admin_service_1.giftCardAdminService.updateDenomination(admin.id, denomination.id, { isActive: false });
        await strict_1.default.rejects(() => gift_card_purchase_service_1.giftCardPurchaseService.instantBuy(customer.id, { denominationId: denomination.id, quantity: 1, useAccountEmail: true }), (error) => error.code === "GIFT_CARD_DENOMINATION_INACTIVE");
        const history = await gift_card_order_service_1.giftCardOrderService.listForCustomer(customer.id, { page: 1, limit: 20 });
        strict_1.default.equal(history.data.length, 2);
        const detail = await gift_card_order_service_1.giftCardOrderService.getForCustomer(customer.id, instantOrder.id);
        strict_1.default.equal(detail.items[0].deliveries.length, 1);
        strict_1.default.ok(detail.items[0].deliveries[0].code.startsWith("TEST-"));
        await strict_1.default.rejects(() => gift_card_order_service_1.giftCardOrderService.getForCustomer(otherCustomer.id, instantOrder.id), (error) => error.code === "ORDER_NOT_FOUND");
        const adminOrders = await gift_card_order_service_1.giftCardOrderService.listForAdmin({ page: 1, limit: 20, email: "delivery@example.test" });
        strict_1.default.equal(adminOrders.data.length, 1);
        strict_1.default.equal((await gift_card_order_service_1.giftCardOrderService.getForAdmin(instantOrder.id)).id, instantOrder.id);
    }
    finally {
        console_digital_delivery_provider_1.digitalDeliveryProvider.deliver = originalDeliver;
        const orders = await prisma_client_1.prismaC.order.findMany({ where: { userId: customer.id }, select: { id: true } });
        const orderIds = orders.map((order) => order.id);
        await prisma_client_1.prismaC.giftCardDelivery.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
        if (denominationId)
            await prisma_client_1.prismaC.giftCardCode.deleteMany({ where: { denominationId } });
        await prisma_client_1.prismaC.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma_client_1.prismaC.order.deleteMany({ where: { id: { in: orderIds } } });
        await prisma_client_1.prismaC.cartItem.deleteMany({ where: { cart: { userId: customer.id } } });
        await prisma_client_1.prismaC.cart.deleteMany({ where: { userId: customer.id } });
        if (denominationId)
            await prisma_client_1.prismaC.giftCardDenomination.deleteMany({ where: { id: denominationId } });
        if (productId)
            await prisma_client_1.prismaC.giftCardProduct.deleteMany({ where: { id: productId } });
        await prisma_client_1.prismaC.auditLog.deleteMany({ where: { actorId: admin.id } });
        await prisma_client_1.prismaC.user.deleteMany({ where: { id: { in: [admin.id, customer.id, otherCustomer.id] } } });
    }
});
