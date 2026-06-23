"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartServices = void 0;
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
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
    const { userId, productId, quantity } = payload;
    if (quantity <= 0) {
        throw new apiAppError_1.ApiAppError(400, "Quantity must be greater than 0");
    }
    const product = await prisma_client_1.prismaC.product.findUnique({
        where: { id: productId },
    });
    if (!product || !product.isActive) {
        throw new apiAppError_1.ApiAppError(404, "Product not found");
    }
    if (product.stockQuantity < quantity) {
        throw new apiAppError_1.ApiAppError(400, "Insufficient product stock");
    }
    const cart = await getOrCreateCart(userId);
    const existingItem = await prisma_client_1.prismaC.cartItem.findUnique({
        where: {
            cartId_productId: {
                cartId: cart.id,
                productId,
            },
        },
    });
    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (product.stockQuantity < newQuantity) {
            throw new apiAppError_1.ApiAppError(400, "Stock limit exceeded");
        }
        return prisma_client_1.prismaC.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQuantity },
        });
    }
    return prisma_client_1.prismaC.cartItem.create({
        data: {
            cartId: cart.id,
            productId,
            quantity,
        },
    });
};
/**
 * Update Cart Item Quantity
 */
const updateCartItem = async (payload) => {
    const { userId, productId, quantity } = payload;
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
            cartId_productId: {
                cartId: cart.id,
                productId,
            },
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
    const product = await prisma_client_1.prismaC.product.findUnique({
        where: { id: productId },
    });
    if (!product || product.stockQuantity < quantity) {
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
    const { userId, productId } = payload;
    const cart = await prisma_client_1.prismaC.cart.findUnique({
        where: { userId },
    });
    if (!cart) {
        throw new apiAppError_1.ApiAppError(404, "Cart not found");
    }
    const cartItem = await prisma_client_1.prismaC.cartItem.findUnique({
        where: {
            cartId_productId: {
                cartId: cart.id,
                productId,
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
