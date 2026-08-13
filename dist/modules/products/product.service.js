"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productServices = void 0;
const client_1 = require("../../generated/prisma/client");
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
const game_top_up_service_1 = require("../game-top-up/game-top-up.service");
const gift_card_service_1 = require("../gift-card/gift-card.service");
const subscription_service_1 = require("../subscription/subscription.service");
const normalizeType = (value) => String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_");
const serviceFor = (type) => {
    switch (normalizeType(type)) {
        case "GIFT_CARD":
            return {
                create: gift_card_service_1.giftCardServices.createGiftCard,
                update: gift_card_service_1.giftCardServices.updateGiftCard,
                remove: gift_card_service_1.giftCardServices.deleteGiftCard,
            };
        case "GAME_TOP_UP":
            return {
                create: game_top_up_service_1.gameTopUpServices.createTopUp,
                update: game_top_up_service_1.gameTopUpServices.updateTopUp,
                remove: game_top_up_service_1.gameTopUpServices.deleteTopUp,
            };
        case "SUBSCRIPTION":
            return {
                create: subscription_service_1.subscriptionServices.createSubscription,
                update: subscription_service_1.subscriptionServices.updateSubscription,
                remove: subscription_service_1.subscriptionServices.deleteSubscription,
            };
        default:
            throw new apiAppError_1.ApiAppError(400, "type must be GIFT_CARD, GAME_TOP_UP or SUBSCRIPTION");
    }
};
const unwrapPayload = (payload) => {
    const type = normalizeType(payload.type ?? payload.productType);
    const detail = type === "GIFT_CARD"
        ? payload.giftCard
        : type === "GAME_TOP_UP"
            ? payload.gameTopUp
            : type === "SUBSCRIPTION"
                ? payload.subscription
                : undefined;
    return { ...payload, ...(detail ?? {}), type };
};
const addProduct = async (payload, userId) => {
    const normalized = unwrapPayload(payload);
    return serviceFor(normalized.type).create(normalized, userId);
};
const findProductType = async (id, includeInactive = true) => {
    const [giftCard, gameTopUp, subscription] = await Promise.all([
        prisma_client_1.prismaC.giftCardProduct.findFirst({
            where: { OR: [{ id }, { slug: id }], deletedAt: null, ...(includeInactive ? {} : { status: "ACTIVE" }) },
            select: { id: true },
        }),
        prisma_client_1.prismaC.gameTopUpProduct.findFirst({
            where: { OR: [{ id }, { slug: id }], deletedAt: null, ...(includeInactive ? {} : { status: "ACTIVE" }) },
            select: { id: true },
        }),
        prisma_client_1.prismaC.subscriptionProduct.findFirst({
            where: { OR: [{ id }, { slug: id }], deletedAt: null, ...(includeInactive ? {} : { status: "ACTIVE" }) },
            select: { id: true },
        }),
    ]);
    if (giftCard)
        return { type: "GIFT_CARD", id: giftCard.id };
    if (gameTopUp)
        return { type: "GAME_TOP_UP", id: gameTopUp.id };
    if (subscription)
        return { type: "SUBSCRIPTION", id: subscription.id };
    throw new apiAppError_1.ApiAppError(404, "Product not found");
};
const updateProduct = async (id, payload, userId) => {
    const current = await findProductType(id);
    const normalized = unwrapPayload({ ...payload, type: payload.type ?? current.type });
    if (normalized.type !== current.type) {
        throw new apiAppError_1.ApiAppError(400, "Changing a product type is not supported");
    }
    return serviceFor(current.type).update(current.id, normalized, userId);
};
const deleteProduct = async (id) => {
    const current = await findProductType(id);
    return serviceFor(current.type).remove(current.id);
};
const getProducts = async (query) => {
    const type = normalizeType(query.type ?? query.productType);
    if (type === "GIFT_CARD")
        return gift_card_service_1.giftCardServices.getGiftCards(query);
    if (type === "GAME_TOP_UP")
        return game_top_up_service_1.gameTopUpServices.getTopUps(query);
    if (type === "SUBSCRIPTION")
        return subscription_service_1.subscriptionServices.getSubscriptions(query);
    if (type) {
        throw new apiAppError_1.ApiAppError(400, "type must be GIFT_CARD, GAME_TOP_UP or SUBSCRIPTION");
    }
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
    const take = page * limit;
    if (query.status && !Object.values(client_1.ProductStatus).includes(query.status)) {
        throw new apiAppError_1.ApiAppError(400, "Invalid product status");
    }
    if (query.isFeatured !== undefined && !["true", "false"].includes(String(query.isFeatured))) {
        throw new apiAppError_1.ApiAppError(400, "isFeatured must be true or false");
    }
    const sharedWhere = {
        deletedAt: null,
        status: query.status ?? client_1.ProductStatus.ACTIVE,
        ...(query.categoryId ? { categoryId: String(query.categoryId) } : {}),
        ...(query.isFeatured !== undefined
            ? { isFeatured: String(query.isFeatured) === "true" }
            : {}),
    };
    const giftCardWhere = {
        ...sharedWhere,
        ...(query.search
            ? {
                OR: ["title", "brand", "slug"].map((field) => ({
                    [field]: { contains: String(query.search), mode: "insensitive" },
                })),
            }
            : {}),
    };
    const topUpWhere = {
        ...sharedWhere,
        ...(query.search
            ? {
                OR: ["title", "name", "slug"].map((field) => ({
                    [field]: { contains: String(query.search), mode: "insensitive" },
                })),
            }
            : {}),
    };
    const subscriptionWhere = {
        ...sharedWhere,
        ...(query.search
            ? {
                OR: ["title", "platformName", "slug"].map((field) => ({
                    [field]: { contains: String(query.search), mode: "insensitive" },
                })),
            }
            : {}),
    };
    const category = { select: { id: true, title: true, slug: true } };
    const [giftCards, topUps, subscriptions, giftCardTotal, topUpTotal, subscriptionTotal] = await Promise.all([
        prisma_client_1.prismaC.giftCardProduct.findMany({
            where: giftCardWhere,
            take,
            orderBy: { createdAt: "desc" },
            include: {
                category,
                denominations: { orderBy: { sortOrder: "asc" } },
            },
        }),
        prisma_client_1.prismaC.gameTopUpProduct.findMany({
            where: topUpWhere,
            take,
            orderBy: { createdAt: "desc" },
            include: {
                category,
                packages: { orderBy: { sortOrder: "asc" } },
                inputFields: { orderBy: { sortOrder: "asc" } },
            },
        }),
        prisma_client_1.prismaC.subscriptionProduct.findMany({
            where: subscriptionWhere,
            take,
            orderBy: { createdAt: "desc" },
            include: {
                category,
                plans: { orderBy: { sortOrder: "asc" } },
                inputFields: { orderBy: { sortOrder: "asc" } },
            },
        }),
        prisma_client_1.prismaC.giftCardProduct.count({ where: giftCardWhere }),
        prisma_client_1.prismaC.gameTopUpProduct.count({ where: topUpWhere }),
        prisma_client_1.prismaC.subscriptionProduct.count({ where: subscriptionWhere }),
    ]);
    const data = [
        ...giftCards.map((item) => ({ ...item, productType: "GIFT_CARD" })),
        ...topUps.map((item) => ({ ...item, productType: "GAME_TOP_UP" })),
        ...subscriptions.map((item) => ({ ...item, productType: "SUBSCRIPTION" })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = giftCardTotal + topUpTotal + subscriptionTotal;
    return {
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        data: data.slice((page - 1) * limit, page * limit),
    };
};
const getSingleProductWithRelated = async (id) => {
    const current = await findProductType(id, false);
    if (current.type === "GIFT_CARD") {
        return {
            ...(await gift_card_service_1.giftCardServices.getGiftCardById(current.id)),
            productType: current.type,
        };
    }
    if (current.type === "GAME_TOP_UP") {
        return {
            ...(await game_top_up_service_1.gameTopUpServices.getTopUpById(current.id)),
            productType: current.type,
        };
    }
    return {
        ...(await subscription_service_1.subscriptionServices.getSubscriptionById(current.id)),
        productType: current.type,
    };
};
const bulkUploadProducts = async (products) => {
    if (!Array.isArray(products) || products.length === 0) {
        throw new apiAppError_1.ApiAppError(400, "products must be a non-empty array");
    }
    const data = [];
    for (const product of products) {
        data.push(await addProduct(product));
    }
    return {
        message: `${data.length} products created successfully`,
        count: data.length,
        data,
    };
};
exports.productServices = {
    addProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    getSingleProductWithRelated,
    bulkUploadProducts,
};
