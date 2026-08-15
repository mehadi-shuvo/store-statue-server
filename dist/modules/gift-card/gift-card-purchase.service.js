"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCardPurchaseService = void 0;
const client_1 = require("../../generated/prisma/client");
const prisma_client_1 = require("../../utils/prisma-client");
const console_digital_delivery_provider_1 = require("./providers/console-digital-delivery.provider");
const gift_card_errors_1 = require("./gift-card.errors");
const gift_card_utils_1 = require("./gift-card.utils");
const resolveDeliveryEmail = async (userId, choice) => {
    if (choice.useAccountEmail) {
        const user = await prisma_client_1.prismaC.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (!user?.email)
            throw (0, gift_card_errors_1.giftCardError)(400, "ACCOUNT_EMAIL_NOT_AVAILABLE", "Account email is not available");
        return (0, gift_card_utils_1.normalizeDeliveryEmail)(user.email);
    }
    if (!choice.deliveryEmail)
        throw (0, gift_card_errors_1.giftCardError)(400, "DELIVERY_EMAIL_REQUIRED", "Delivery email is required");
    return (0, gift_card_utils_1.normalizeDeliveryEmail)(choice.deliveryEmail);
};
const mergeLines = (lines) => {
    const merged = new Map();
    for (const line of lines)
        merged.set(line.denominationId, (merged.get(line.denominationId) ?? 0) + line.quantity);
    return [...merged].map(([denominationId, quantity]) => ({ denominationId, quantity }));
};
const allocateCodes = async (tx, denominationId, orderItemId, quantity, soldAt) => {
    const codes = await tx.$queryRaw(client_1.Prisma.sql `
    SELECT "id", "code", "pin", "expiryDate"
    FROM "gift_card_codes"
    WHERE "denominationId" = ${denominationId}
      AND "status" = 'AVAILABLE'::"GiftCardCodeStatus"
      AND ("expiryDate" IS NULL OR "expiryDate" > NOW())
    ORDER BY "createdAt" ASC
    FOR UPDATE SKIP LOCKED
    LIMIT ${quantity}
  `);
    if (codes.length !== quantity) {
        throw (0, gift_card_errors_1.giftCardError)(409, "INSUFFICIENT_GIFT_CARD_STOCK", "Not enough gift card codes are available", {
            denominationId,
            requested: quantity,
            available: codes.length,
        });
    }
    const updated = await tx.giftCardCode.updateMany({
        where: { id: { in: codes.map((code) => code.id) }, status: client_1.GiftCardCodeStatus.AVAILABLE },
        data: { status: client_1.GiftCardCodeStatus.SOLD, soldAt, reservedAt: null, orderItemId },
    });
    if (updated.count !== quantity) {
        throw (0, gift_card_errors_1.giftCardError)(409, "GIFT_CARD_OUT_OF_STOCK", "Gift card stock changed during checkout");
    }
    return codes;
};
const createPurchase = async (userId, rawLines, choice, cartItemIds = []) => {
    const lines = mergeLines(rawLines);
    if (!lines.length || lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20)) {
        throw (0, gift_card_errors_1.giftCardError)(400, "INVALID_CART", "Purchase quantities must be between 1 and 20");
    }
    const deliveryEmail = await resolveDeliveryEmail(userId, choice);
    const fulfilledAt = new Date();
    const completed = await prisma_client_1.prismaC.$transaction(async (tx) => {
        const denominations = await tx.giftCardDenomination.findMany({
            where: { id: { in: lines.map((line) => line.denominationId) } },
            include: { giftCardProduct: true },
        });
        if (denominations.length !== lines.length) {
            throw (0, gift_card_errors_1.giftCardError)(404, "GIFT_CARD_DENOMINATION_NOT_FOUND", "A gift card denomination was not found");
        }
        const selections = lines.map((line) => {
            const denomination = denominations.find((item) => item.id === line.denominationId);
            if (denomination.giftCardProduct.deletedAt || denomination.giftCardProduct.status !== client_1.ProductStatus.ACTIVE) {
                throw (0, gift_card_errors_1.giftCardError)(409, "GIFT_CARD_INACTIVE", "Gift card is not active");
            }
            if (!denomination.isActive) {
                throw (0, gift_card_errors_1.giftCardError)(409, "GIFT_CARD_DENOMINATION_INACTIVE", "Gift card denomination is not active");
            }
            return { line, denomination, product: denomination.giftCardProduct };
        });
        const subtotal = selections.reduce((sum, selection) => sum.add(selection.denomination.sellingPriceBDT.mul(selection.line.quantity)), new client_1.Prisma.Decimal(0));
        const order = await tx.order.create({
            data: {
                orderNumber: (0, gift_card_utils_1.createGiftCardOrderNumber)(),
                userId,
                deliveryEmail,
                subtotal,
                discountTotal: new client_1.Prisma.Decimal(0),
                totalCost: subtotal,
                status: client_1.OrderStatus.PROCESSING,
                paymentStatus: client_1.PaymentStatus.PENDING,
            },
        });
        const deliveryPayload = [];
        for (const { line, denomination, product } of selections) {
            const lineTotal = denomination.sellingPriceBDT.mul(line.quantity);
            const orderItem = await tx.orderItem.create({
                data: {
                    orderId: order.id,
                    productType: client_1.DigitalProductType.GIFT_CARD,
                    quantity: line.quantity,
                    unitPrice: denomination.sellingPriceBDT,
                    totalPrice: lineTotal,
                    productTitle: product.title,
                    optionTitle: `${(0, gift_card_utils_1.moneyString)(denomination.cardValue)} ${denomination.cardCurrency}`,
                    productImage: product.image,
                    deliveryStatus: client_1.DeliveryStatus.PROCESSING,
                    giftCardProductId: product.id,
                    giftCardDenominationId: denomination.id,
                    brandSnapshot: product.brand,
                    faceValueSnapshot: denomination.cardValue,
                    faceCurrencySnapshot: denomination.cardCurrency,
                },
            });
            const codes = await allocateCodes(tx, denomination.id, orderItem.id, line.quantity, fulfilledAt);
            for (const code of codes) {
                await tx.giftCardDelivery.create({
                    data: {
                        orderItemId: orderItem.id,
                        inventoryCodeId: code.id,
                        cardNameSnapshot: product.title,
                        brandSnapshot: product.brand,
                        faceValueSnapshot: denomination.cardValue,
                        currencySnapshot: denomination.cardCurrency,
                        expiryDateSnapshot: code.expiryDate,
                        deliveryEmail,
                        deliveryStatus: client_1.DeliveryStatus.DELIVERED,
                        deliveredAt: fulfilledAt,
                    },
                });
                deliveryPayload.push({
                    giftCard: product.title,
                    brand: product.brand,
                    faceValue: (0, gift_card_utils_1.moneyString)(denomination.cardValue),
                    currency: denomination.cardCurrency,
                    code: code.code,
                    pin: code.pin,
                    expiryDate: code.expiryDate,
                });
            }
            await tx.orderItem.update({
                where: { id: orderItem.id },
                data: { deliveryStatus: client_1.DeliveryStatus.DELIVERED, fulfilledAt },
            });
        }
        if (cartItemIds.length) {
            await tx.cartItem.deleteMany({ where: { id: { in: cartItemIds }, cart: { userId } } });
        }
        await tx.order.update({ where: { id: order.id }, data: { status: client_1.OrderStatus.COMPLETED } });
        return { orderId: order.id, orderNumber: order.orderNumber, deliveryPayload, subtotal };
    }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
    try {
        await console_digital_delivery_provider_1.digitalDeliveryProvider.deliver({
            to: deliveryEmail,
            orderNumber: completed.orderNumber,
            cards: completed.deliveryPayload,
        });
    }
    catch (error) {
        await prisma_client_1.prismaC.$transaction([
            prisma_client_1.prismaC.giftCardDelivery.updateMany({
                where: { orderItem: { orderId: completed.orderId } },
                data: { deliveryStatus: client_1.DeliveryStatus.FAILED, failureReason: "Digital delivery provider failed" },
            }),
            prisma_client_1.prismaC.orderItem.updateMany({
                where: { orderId: completed.orderId, productType: client_1.DigitalProductType.GIFT_CARD },
                data: { deliveryStatus: client_1.DeliveryStatus.FAILED, failureReason: "Digital delivery provider failed" },
            }),
            prisma_client_1.prismaC.order.update({ where: { id: completed.orderId }, data: { status: client_1.OrderStatus.PROCESSING } }),
        ]);
        throw (0, gift_card_errors_1.giftCardError)(502, "GIFT_CARD_DELIVERY_FAILED", "The order was created, but digital delivery failed");
    }
    return {
        id: completed.orderId,
        orderNumber: completed.orderNumber,
        deliveryEmail,
        totalBdt: (0, gift_card_utils_1.moneyString)(completed.subtotal),
        status: client_1.OrderStatus.COMPLETED,
        paymentStatus: client_1.PaymentStatus.PENDING,
    };
};
const instantBuy = (userId, input) => createPurchase(userId, [{ denominationId: input.denominationId, quantity: input.quantity }], input);
const checkoutCart = async (userId, choice) => {
    const cart = await prisma_client_1.prismaC.cart.findUnique({ where: { userId }, include: { items: true } });
    if (!cart?.items.length)
        throw (0, gift_card_errors_1.giftCardError)(400, "EMPTY_CART", "Cart is empty");
    if (cart.items.some((item) => item.productType !== client_1.DigitalProductType.GIFT_CARD || !item.giftCardDenominationId)) {
        throw (0, gift_card_errors_1.giftCardError)(400, "INVALID_CART", "Gift card checkout cannot contain other product types");
    }
    return createPurchase(userId, cart.items.map((item) => ({ denominationId: item.giftCardDenominationId, quantity: item.quantity })), choice, cart.items.map((item) => item.id));
};
exports.giftCardPurchaseService = { instantBuy, checkoutCart, createPurchase };
