"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartServices = void 0;
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
const client_1 = require("../../generated/prisma/client");
/**
 * Get or Create Cart for User
 */
const getOrCreateCart = async (userId) => {
    let cart = await prisma_client_1.prismaC.cart.findUnique({
        where: { userId },
        include: {
            items: {
                include: {
                    product: true,
                    giftCardDenomination: true,
                    gameTopUpPackage: true,
                    subscriptionPlan: true,
                },
            },
        },
    });
    if (!cart) {
        cart = await prisma_client_1.prismaC.cart.create({
            data: { userId },
            include: {
                items: {
                    include: {
                        product: true,
                        giftCardDenomination: true,
                        gameTopUpPackage: true,
                        subscriptionPlan: true,
                    },
                },
            },
        });
    }
    return cart;
};
/**
 * Add Item to Cart
 */
const addToCart = async (payload) => {
    const { userId, productId, giftCardDenominationId, gameTopUpPackageId, subscriptionPlanId, customerInputs, quantity, } = payload;
    const selectedOptionCount = [
        giftCardDenominationId,
        gameTopUpPackageId,
        subscriptionPlanId,
    ].filter(Boolean).length;
    if (selectedOptionCount > 1) {
        throw new apiAppError_1.ApiAppError(400, "Only one product option can be selected");
    }
    const optionKey = giftCardDenominationId
        ? `gift-card:${giftCardDenominationId}`
        : gameTopUpPackageId
            ? `game-top-up:${gameTopUpPackageId}`
            : subscriptionPlanId
                ? `subscription:${subscriptionPlanId}`
                : "default";
    if (quantity <= 0) {
        throw new apiAppError_1.ApiAppError(400, "Quantity must be greater than 0");
    }
    const product = await prisma_client_1.prismaC.product.findUnique({
        where: { id: productId },
    });
    if (!product || !product.isActive) {
        throw new apiAppError_1.ApiAppError(404, "Product not found");
    }
    if (product.type === client_1.ProductType.PHYSICAL && selectedOptionCount > 0) {
        throw new apiAppError_1.ApiAppError(400, "Physical products do not accept digital options");
    }
    if (product.type === client_1.ProductType.GIFT_CARD && !giftCardDenominationId) {
        throw new apiAppError_1.ApiAppError(400, "Gift card denomination is required");
    }
    if (product.type === client_1.ProductType.GAME_TOP_UP && !gameTopUpPackageId) {
        throw new apiAppError_1.ApiAppError(400, "Game top-up package is required");
    }
    if (product.type === client_1.ProductType.SUBSCRIPTION && !subscriptionPlanId) {
        throw new apiAppError_1.ApiAppError(400, "Subscription plan is required");
    }
    let unitPrice = product.price;
    let stockQuantity = product.stockQuantity;
    if (giftCardDenominationId) {
        const denomination = await prisma_client_1.prismaC.giftCardDenomination.findFirst({
            where: {
                id: giftCardDenominationId,
                isActive: true,
                giftCardProduct: { is: { productId } },
            },
        });
        if (!denomination) {
            throw new apiAppError_1.ApiAppError(404, "Gift card denomination not found");
        }
        unitPrice = denomination.bdtPrice;
        stockQuantity = denomination.stockQuantity;
    }
    if (gameTopUpPackageId) {
        const topUpPackage = await prisma_client_1.prismaC.gameTopUpPackage.findFirst({
            where: {
                id: gameTopUpPackageId,
                isActive: true,
                gameTopUpProduct: { is: { productId } },
            },
        });
        if (!topUpPackage) {
            throw new apiAppError_1.ApiAppError(404, "Game top-up package not found");
        }
        unitPrice = topUpPackage.price;
        stockQuantity = topUpPackage.stockQuantity;
    }
    if (subscriptionPlanId) {
        const subscriptionPlan = await prisma_client_1.prismaC.subscriptionPlan.findFirst({
            where: {
                id: subscriptionPlanId,
                isActive: true,
                subscriptionProduct: { is: { productId } },
            },
        });
        if (!subscriptionPlan) {
            throw new apiAppError_1.ApiAppError(404, "Subscription plan not found");
        }
        unitPrice = subscriptionPlan.price;
        stockQuantity = subscriptionPlan.stockQuantity;
    }
    if (stockQuantity !== null && stockQuantity < quantity) {
        throw new apiAppError_1.ApiAppError(400, "Insufficient product stock");
    }
    const cart = await getOrCreateCart(userId);
    const existingItem = await prisma_client_1.prismaC.cartItem.findUnique({
        where: {
            cartId_productId_optionKey: {
                cartId: cart.id,
                productId,
                optionKey,
            },
        },
    });
    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (stockQuantity !== null && stockQuantity < newQuantity) {
            throw new apiAppError_1.ApiAppError(400, "Stock limit exceeded");
        }
        return prisma_client_1.prismaC.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQuantity, customerInputs },
        });
    }
    return prisma_client_1.prismaC.cartItem.create({
        data: {
            cartId: cart.id,
            productId,
            giftCardDenominationId,
            gameTopUpPackageId,
            subscriptionPlanId,
            optionKey,
            quantity,
            customerInputs,
            unitPrice,
        },
    });
};
/**
 * Update Cart Item Quantity
 */
const updateCartItem = async (payload) => {
    const { userId, productId, giftCardDenominationId, gameTopUpPackageId, subscriptionPlanId, quantity, } = payload;
    const optionKey = giftCardDenominationId
        ? `gift-card:${giftCardDenominationId}`
        : gameTopUpPackageId
            ? `game-top-up:${gameTopUpPackageId}`
            : subscriptionPlanId
                ? `subscription:${subscriptionPlanId}`
                : "default";
    if (quantity < 0) {
        throw new apiAppError_1.ApiAppError(400, "Quantity cannot be negative");
    }
    const cart = await prisma_client_1.prismaC.cart.findUnique({
        where: { userId },
    });
    if (!cart) {
        throw new apiAppError_1.ApiAppError(404, "Cart not found");
    }
    const cartItem = await prisma_client_1.prismaC.cartItem.findUnique({
        where: {
            cartId_productId_optionKey: {
                cartId: cart.id,
                productId,
                optionKey,
            },
        },
        include: {
            product: true,
            giftCardDenomination: true,
            gameTopUpPackage: true,
            subscriptionPlan: true,
        },
    });
    if (!cartItem) {
        throw new apiAppError_1.ApiAppError(404, "Cart item not found");
    }
    if (quantity === 0) {
        return prisma_client_1.prismaC.cartItem.delete({
            where: { id: cartItem.id },
        });
    }
    const stockQuantity = cartItem.giftCardDenomination
        ? cartItem.giftCardDenomination.stockQuantity
        : cartItem.gameTopUpPackage
            ? cartItem.gameTopUpPackage.stockQuantity
            : cartItem.subscriptionPlan
                ? cartItem.subscriptionPlan.stockQuantity
                : cartItem.product.stockQuantity;
    if (!cartItem.product.isActive ||
        (stockQuantity !== null && stockQuantity < quantity)) {
        throw new apiAppError_1.ApiAppError(400, "Insufficient product stock");
    }
    return prisma_client_1.prismaC.cartItem.update({
        where: { id: cartItem.id },
        data: { quantity },
    });
};
/**
 * Remove Item from Cart
 */
const removeFromCart = async (payload) => {
    const { userId, productId, giftCardDenominationId, gameTopUpPackageId, subscriptionPlanId, } = payload;
    const optionKey = giftCardDenominationId
        ? `gift-card:${giftCardDenominationId}`
        : gameTopUpPackageId
            ? `game-top-up:${gameTopUpPackageId}`
            : subscriptionPlanId
                ? `subscription:${subscriptionPlanId}`
                : "default";
    const cart = await prisma_client_1.prismaC.cart.findUnique({
        where: { userId },
    });
    if (!cart) {
        throw new apiAppError_1.ApiAppError(404, "Cart not found");
    }
    const cartItem = await prisma_client_1.prismaC.cartItem.findUnique({
        where: {
            cartId_productId_optionKey: {
                cartId: cart.id,
                productId,
                optionKey,
            },
        },
    });
    if (!cartItem) {
        throw new apiAppError_1.ApiAppError(404, "Cart item not found");
    }
    return prisma_client_1.prismaC.cartItem.delete({
        where: { id: cartItem.id },
    });
};
/**
 * Get Cart Details
 */
const getCart = async (userId) => {
    return getOrCreateCart(userId);
};
/**
 * Clear Cart
 */
const clearCart = async (userId) => {
    const cart = await getOrCreateCart(userId);
    await prisma_client_1.prismaC.cartItem.deleteMany({
        where: { cartId: cart.id },
    });
    return { message: "Cart cleared successfully" };
};
exports.cartServices = {
    addToCart,
    updateCartItem,
    removeFromCart,
    getCart,
    clearCart,
};
