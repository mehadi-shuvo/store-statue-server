"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewServices = void 0;
const client_1 = require("../../generated/prisma/client");
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
const resolveProduct = async (productId, requestedType) => {
    if (!productId)
        throw new apiAppError_1.ApiAppError(400, "productId is required");
    const [giftCard, gameTopUp, subscription] = await Promise.all([
        !requestedType || requestedType === client_1.DigitalProductType.GIFT_CARD
            ? prisma_client_1.prismaC.giftCardProduct.findFirst({
                where: { id: productId, status: client_1.ProductStatus.ACTIVE, deletedAt: null },
                select: { id: true },
            })
            : null,
        !requestedType || requestedType === client_1.DigitalProductType.GAME_TOP_UP
            ? prisma_client_1.prismaC.gameTopUpProduct.findFirst({
                where: { id: productId, status: client_1.ProductStatus.ACTIVE, deletedAt: null },
                select: { id: true },
            })
            : null,
        !requestedType || requestedType === client_1.DigitalProductType.SUBSCRIPTION
            ? prisma_client_1.prismaC.subscriptionProduct.findFirst({
                where: { id: productId, status: client_1.ProductStatus.ACTIVE, deletedAt: null },
                select: { id: true },
            })
            : null,
    ]);
    const matches = [
        giftCard && client_1.DigitalProductType.GIFT_CARD,
        gameTopUp && client_1.DigitalProductType.GAME_TOP_UP,
        subscription && client_1.DigitalProductType.SUBSCRIPTION,
    ].filter((value) => Boolean(value));
    if (matches.length === 0)
        throw new apiAppError_1.ApiAppError(404, "Product not found");
    if (matches.length > 1) {
        throw new apiAppError_1.ApiAppError(409, "productType is required for this product id");
    }
    return matches[0];
};
const findExistingReview = (userId, productId, productType) => {
    if (productType === client_1.DigitalProductType.GIFT_CARD) {
        return prisma_client_1.prismaC.review.findUnique({
            where: { userId_giftCardProductId: { userId, giftCardProductId: productId } },
        });
    }
    if (productType === client_1.DigitalProductType.GAME_TOP_UP) {
        return prisma_client_1.prismaC.review.findUnique({
            where: { userId_gameTopUpProductId: { userId, gameTopUpProductId: productId } },
        });
    }
    return prisma_client_1.prismaC.review.findUnique({
        where: {
            userId_subscriptionProductId: { userId, subscriptionProductId: productId },
        },
    });
};
const createReview = async (payload) => {
    const { userId, productId, rating, comment } = payload;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new apiAppError_1.ApiAppError(400, "Rating must be an integer between 1 and 5");
    }
    const productType = await resolveProduct(productId, payload.productType);
    if (await findExistingReview(userId, productId, productType)) {
        throw new apiAppError_1.ApiAppError(409, "You have already reviewed this product");
    }
    return prisma_client_1.prismaC.review.create({
        data: {
            userId,
            productType,
            rating,
            comment,
            ...(productType === client_1.DigitalProductType.GIFT_CARD
                ? { giftCardProductId: productId }
                : productType === client_1.DigitalProductType.GAME_TOP_UP
                    ? { gameTopUpProductId: productId }
                    : { subscriptionProductId: productId }),
        },
    });
};
const updateReview = async (reviewId, userId, payload) => {
    const review = await prisma_client_1.prismaC.review.findUnique({ where: { id: reviewId } });
    if (!review)
        throw new apiAppError_1.ApiAppError(404, "Review not found");
    if (review.userId !== userId)
        throw new apiAppError_1.ApiAppError(403, "Access denied");
    if (payload.rating !== undefined &&
        (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5)) {
        throw new apiAppError_1.ApiAppError(400, "Rating must be an integer between 1 and 5");
    }
    if (payload.rating === undefined && payload.comment === undefined) {
        throw new apiAppError_1.ApiAppError(400, "At least one review field is required");
    }
    return prisma_client_1.prismaC.review.update({ where: { id: reviewId }, data: payload });
};
const deleteReview = async (reviewId, userId) => {
    const review = await prisma_client_1.prismaC.review.findUnique({ where: { id: reviewId } });
    if (!review)
        throw new apiAppError_1.ApiAppError(404, "Review not found");
    if (review.userId !== userId)
        throw new apiAppError_1.ApiAppError(403, "Access denied");
    await prisma_client_1.prismaC.review.delete({ where: { id: reviewId } });
    return { message: "Review deleted successfully" };
};
const getProductReviews = async (productId) => {
    if (!productId)
        throw new apiAppError_1.ApiAppError(400, "productId is required");
    return prisma_client_1.prismaC.review.findMany({
        where: {
            OR: [
                { giftCardProductId: productId },
                { gameTopUpProductId: productId },
                { subscriptionProductId: productId },
            ],
        },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
    });
};
exports.reviewServices = {
    createReview,
    updateReview,
    deleteReview,
    getProductReviews,
};
