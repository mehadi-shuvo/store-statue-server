"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartServices = void 0;
const client_1 = require("../../generated/prisma/client");
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
const cartItemInclude = {
    giftCardProduct: true,
    giftCardDenomination: true,
    gameTopUpProduct: true,
    gameTopUpPackage: true,
    subscriptionProduct: true,
    subscriptionPlan: true,
};
const getProductType = (payload) => {
    const selectedOptions = [
        payload.giftCardDenominationId,
        payload.gameTopUpPackageId,
        payload.subscriptionPlanId,
    ].filter((value) => Boolean(value));
    if (!payload.productId || selectedOptions.length !== 1) {
        throw new apiAppError_1.ApiAppError(400, "productId and exactly one digital product option are required");
    }
    if (payload.giftCardDenominationId)
        return client_1.DigitalProductType.GIFT_CARD;
    if (payload.gameTopUpPackageId)
        return client_1.DigitalProductType.GAME_TOP_UP;
    return client_1.DigitalProductType.SUBSCRIPTION;
};
const getOptionKey = (payload) => {
    if (payload.giftCardDenominationId) {
        return `gift-card:${payload.giftCardDenominationId}`;
    }
    if (payload.gameTopUpPackageId) {
        return `game-top-up:${payload.gameTopUpPackageId}`;
    }
    return `subscription:${payload.subscriptionPlanId}`;
};
const itemMatchesProduct = (item, productType, productId) => {
    if (productType === client_1.DigitalProductType.GIFT_CARD) {
        return item.giftCardProductId === productId;
    }
    if (productType === client_1.DigitalProductType.GAME_TOP_UP) {
        return item.gameTopUpProductId === productId;
    }
    return item.subscriptionProductId === productId;
};
const getOrCreateCart = async (userId) => {
    const existingCart = await prisma_client_1.prismaC.cart.findUnique({
        where: { userId },
        include: { items: { include: cartItemInclude } },
    });
    if (existingCart)
        return existingCart;
    return prisma_client_1.prismaC.cart.create({
        data: { userId },
        include: { items: { include: cartItemInclude } },
    });
};
const resolveProductOption = async (payload) => {
    const productType = getProductType(payload);
    if (productType === client_1.DigitalProductType.GIFT_CARD) {
        const option = await prisma_client_1.prismaC.giftCardDenomination.findFirst({
            where: {
                id: payload.giftCardDenominationId,
                giftCardProductId: payload.productId,
                isActive: true,
                giftCardProduct: {
                    is: { status: client_1.ProductStatus.ACTIVE, deletedAt: null },
                },
            },
        });
        if (!option)
            throw new apiAppError_1.ApiAppError(404, "Gift card denomination not found");
        return {
            productType,
            unitPrice: option.sellingPriceBDT,
            stockQuantity: option.stockQuantity,
        };
    }
    if (productType === client_1.DigitalProductType.GAME_TOP_UP) {
        const option = await prisma_client_1.prismaC.gameTopUpPackage.findFirst({
            where: {
                id: payload.gameTopUpPackageId,
                gameTopUpProductId: payload.productId,
                isActive: true,
                gameTopUpProduct: {
                    is: { status: client_1.ProductStatus.ACTIVE, deletedAt: null },
                },
            },
        });
        if (!option)
            throw new apiAppError_1.ApiAppError(404, "Game top-up package not found");
        return {
            productType,
            unitPrice: option.sellingPriceBDT,
            stockQuantity: option.stockQuantity,
        };
    }
    const option = await prisma_client_1.prismaC.subscriptionPlan.findFirst({
        where: {
            id: payload.subscriptionPlanId,
            subscriptionProductId: payload.productId,
            isActive: true,
            subscriptionProduct: {
                is: { status: client_1.ProductStatus.ACTIVE, deletedAt: null },
            },
        },
    });
    if (!option)
        throw new apiAppError_1.ApiAppError(404, "Subscription plan not found");
    return {
        productType,
        unitPrice: option.sellingPriceBDT,
        stockQuantity: option.stockQuantity,
    };
};
const addToCart = async (payload) => {
    if (!Number.isInteger(payload.quantity) || payload.quantity <= 0) {
        throw new apiAppError_1.ApiAppError(400, "Quantity must be a positive integer");
    }
    const option = await resolveProductOption(payload);
    if (option.stockQuantity !== null && option.stockQuantity < payload.quantity) {
        throw new apiAppError_1.ApiAppError(400, "Insufficient product stock");
    }
    const cart = await getOrCreateCart(payload.userId);
    const optionKey = getOptionKey(payload);
    const existingItem = await prisma_client_1.prismaC.cartItem.findUnique({
        where: {
            cartId_productType_optionKey: {
                cartId: cart.id,
                productType: option.productType,
                optionKey,
            },
        },
    });
    if (existingItem) {
        if (!itemMatchesProduct(existingItem, option.productType, payload.productId)) {
            throw new apiAppError_1.ApiAppError(409, "Cart option conflicts with another product");
        }
        const newQuantity = existingItem.quantity + payload.quantity;
        if (option.stockQuantity !== null && option.stockQuantity < newQuantity) {
            throw new apiAppError_1.ApiAppError(400, "Stock limit exceeded");
        }
        return prisma_client_1.prismaC.cartItem.update({
            where: { id: existingItem.id },
            data: {
                quantity: newQuantity,
                unitPrice: option.unitPrice,
                ...(payload.customerInputs !== undefined
                    ? { customerInputs: payload.customerInputs }
                    : {}),
            },
            include: cartItemInclude,
        });
    }
    return prisma_client_1.prismaC.cartItem.create({
        data: {
            cartId: cart.id,
            productType: option.productType,
            optionKey,
            quantity: payload.quantity,
            unitPrice: option.unitPrice,
            ...(payload.customerInputs !== undefined
                ? { customerInputs: payload.customerInputs }
                : {}),
            ...(option.productType === client_1.DigitalProductType.GIFT_CARD
                ? {
                    giftCardProductId: payload.productId,
                    giftCardDenominationId: payload.giftCardDenominationId,
                }
                : option.productType === client_1.DigitalProductType.GAME_TOP_UP
                    ? {
                        gameTopUpProductId: payload.productId,
                        gameTopUpPackageId: payload.gameTopUpPackageId,
                    }
                    : {
                        subscriptionProductId: payload.productId,
                        subscriptionPlanId: payload.subscriptionPlanId,
                    }),
        },
        include: cartItemInclude,
    });
};
const findCartItem = async (payload) => {
    const productType = getProductType(payload);
    const cart = await prisma_client_1.prismaC.cart.findUnique({ where: { userId: payload.userId } });
    if (!cart)
        throw new apiAppError_1.ApiAppError(404, "Cart not found");
    const item = await prisma_client_1.prismaC.cartItem.findUnique({
        where: {
            cartId_productType_optionKey: {
                cartId: cart.id,
                productType,
                optionKey: getOptionKey(payload),
            },
        },
        include: cartItemInclude,
    });
    if (!item || !itemMatchesProduct(item, productType, payload.productId)) {
        throw new apiAppError_1.ApiAppError(404, "Cart item not found");
    }
    return item;
};
const updateCartItem = async (payload) => {
    if (!Number.isInteger(payload.quantity) || payload.quantity < 0) {
        throw new apiAppError_1.ApiAppError(400, "Quantity must be a non-negative integer");
    }
    const item = await findCartItem(payload);
    if (payload.quantity === 0) {
        return prisma_client_1.prismaC.cartItem.delete({ where: { id: item.id } });
    }
    const option = await resolveProductOption(payload);
    if (option.stockQuantity !== null && option.stockQuantity < payload.quantity) {
        throw new apiAppError_1.ApiAppError(400, "Insufficient product stock");
    }
    return prisma_client_1.prismaC.cartItem.update({
        where: { id: item.id },
        data: { quantity: payload.quantity, unitPrice: option.unitPrice },
        include: cartItemInclude,
    });
};
const removeFromCart = async (payload) => {
    const item = await findCartItem(payload);
    return prisma_client_1.prismaC.cartItem.delete({ where: { id: item.id } });
};
const getCart = async (userId) => getOrCreateCart(userId);
const clearCart = async (userId) => {
    const cart = await getOrCreateCart(userId);
    await prisma_client_1.prismaC.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { message: "Cart cleared successfully" };
};
exports.cartServices = {
    addToCart,
    updateCartItem,
    removeFromCart,
    getCart,
    clearCart,
};
