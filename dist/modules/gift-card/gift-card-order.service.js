"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCardOrderService = void 0;
const client_1 = require("../../generated/prisma/client");
const prisma_client_1 = require("../../utils/prisma-client");
const gift_card_errors_1 = require("./gift-card.errors");
const gift_card_utils_1 = require("./gift-card.utils");
const listForCustomer = async (userId, query) => {
    const where = { userId, items: { some: { productType: client_1.DigitalProductType.GIFT_CARD } } };
    const [orders, total] = await prisma_client_1.prismaC.$transaction([
        prisma_client_1.prismaC.order.findMany({
            where,
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            orderBy: { createdAt: "desc" },
            select: {
                id: true, orderNumber: true, totalCost: true, status: true, paymentStatus: true, createdAt: true,
                items: {
                    where: { productType: client_1.DigitalProductType.GIFT_CARD },
                    select: { id: true, productTitle: true, productImage: true, brandSnapshot: true, faceValueSnapshot: true, faceCurrencySnapshot: true, unitPrice: true, quantity: true, deliveryStatus: true },
                },
            },
        }),
        prisma_client_1.prismaC.order.count({ where }),
    ]);
    return {
        data: orders.map((order) => ({
            ...order,
            totalBdt: (0, gift_card_utils_1.moneyString)(order.totalCost),
            items: order.items.map((item) => ({
                ...item,
                giftCardName: item.productTitle,
                brand: item.brandSnapshot,
                faceValue: item.faceValueSnapshot ? (0, gift_card_utils_1.moneyString)(item.faceValueSnapshot) : null,
                currency: item.faceCurrencySnapshot,
                priceBdt: (0, gift_card_utils_1.moneyString)(item.unitPrice),
            })),
        })),
        meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
};
const getForCustomer = async (userId, orderId) => {
    const order = await prisma_client_1.prismaC.order.findFirst({
        where: { id: orderId, userId, items: { some: { productType: client_1.DigitalProductType.GIFT_CARD } } },
        include: {
            items: {
                where: { productType: client_1.DigitalProductType.GIFT_CARD },
                include: {
                    giftCardDeliveries: {
                        include: { inventoryCode: { select: { code: true, pin: true, expiryDate: true, status: true } } },
                    },
                },
            },
        },
    });
    if (!order)
        throw (0, gift_card_errors_1.giftCardError)(404, "ORDER_NOT_FOUND", "Gift card order not found");
    const canReveal = order.status === client_1.OrderStatus.COMPLETED;
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        deliveryEmail: order.deliveryEmail,
        totalBdt: (0, gift_card_utils_1.moneyString)(order.totalCost),
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
            id: item.id,
            giftCardName: item.productTitle,
            brand: item.brandSnapshot,
            imageUrl: item.productImage,
            faceValue: item.faceValueSnapshot ? (0, gift_card_utils_1.moneyString)(item.faceValueSnapshot) : null,
            currency: item.faceCurrencySnapshot,
            priceBdt: (0, gift_card_utils_1.moneyString)(item.unitPrice),
            quantity: item.quantity,
            deliveryStatus: item.deliveryStatus,
            deliveries: canReveal ? item.giftCardDeliveries.filter((delivery) => delivery.deliveryStatus === client_1.DeliveryStatus.DELIVERED).map((delivery) => ({
                code: delivery.inventoryCode.code,
                pin: delivery.inventoryCode.pin,
                expiryDate: delivery.expiryDateSnapshot,
            })) : [],
        })),
    };
};
const listForAdmin = async (query) => {
    const where = {
        items: { some: { productType: client_1.DigitalProductType.GIFT_CARD } },
        ...(query.status && { status: query.status }),
        ...(query.paymentStatus && { paymentStatus: query.paymentStatus }),
        ...(query.email && { deliveryEmail: { contains: query.email, mode: "insensitive" } }),
        ...(query.orderNumber && { orderNumber: { contains: query.orderNumber, mode: "insensitive" } }),
        ...((query.from || query.to) && { createdAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } }),
    };
    const [data, total] = await prisma_client_1.prismaC.$transaction([
        prisma_client_1.prismaC.order.findMany({
            where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: "desc" },
            select: {
                id: true, orderNumber: true, deliveryEmail: true, totalCost: true, status: true, paymentStatus: true, createdAt: true,
                user: { select: { id: true, email: true, name: true } },
                _count: { select: { items: true } },
            },
        }),
        prisma_client_1.prismaC.order.count({ where }),
    ]);
    return { data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
};
const getForAdmin = async (orderId) => {
    const order = await prisma_client_1.prismaC.order.findFirst({
        where: { id: orderId, items: { some: { productType: client_1.DigitalProductType.GIFT_CARD } } },
        include: {
            user: { select: { id: true, email: true, name: true } },
            items: {
                where: { productType: client_1.DigitalProductType.GIFT_CARD },
                include: { giftCardDeliveries: { include: { inventoryCode: true } } },
            },
        },
    });
    if (!order)
        throw (0, gift_card_errors_1.giftCardError)(404, "ORDER_NOT_FOUND", "Gift card order not found");
    return order;
};
exports.giftCardOrderService = { listForCustomer, getForCustomer, listForAdmin, getForAdmin };
