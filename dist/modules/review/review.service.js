"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewServices = void 0;
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
/**
 * Create Review
 */
const createReview = async (payload) => {
    const { userId, productId, rating, comment } = payload;
    // Rating validation
    if (rating < 1 || rating > 5) {
        throw new apiAppError_1.ApiAppError(400, "Rating must be between 1 and 5");
    }
    // Product validation
    const product = await prisma_client_1.prismaC.product.findFirst({
        where: {
            id: productId,
            isActive: true,
        },
    });
    if (!product) {
        throw new apiAppError_1.ApiAppError(404, "Product not found");
    }
    // Duplicate review check
    const existingReview = await prisma_client_1.prismaC.review.findUnique({
        where: {
            userId_productId: {
                userId,
                productId,
            },
        },
    });
    if (existingReview) {
        throw new apiAppError_1.ApiAppError(409, "You have already reviewed this product");
    }
    return prisma_client_1.prismaC.review.create({
        data: {
            userId,
            productId,
            rating,
            comment,
        },
    });
};
/**
 * Update Review (Only Owner)
 */
const updateReview = async (reviewId, userId, payload) => {
    const review = await prisma_client_1.prismaC.review.findUnique({
        where: { id: reviewId },
    });
    if (!review) {
        throw new apiAppError_1.ApiAppError(404, "Review not found");
    }
    if (review.userId !== userId) {
        throw new apiAppError_1.ApiAppError(403, "Access denied");
    }
    if (payload.rating && (payload.rating < 1 || payload.rating > 5)) {
        throw new apiAppError_1.ApiAppError(400, "Rating must be between 1 and 5");
    }
    return prisma_client_1.prismaC.review.update({
        where: { id: reviewId },
        data: payload,
    });
};
/**
 * Delete Review (Only Owner)
 */
const deleteReview = async (reviewId, userId) => {
    const review = await prisma_client_1.prismaC.review.findUnique({
        where: { id: reviewId },
    });
    if (!review) {
        throw new apiAppError_1.ApiAppError(404, "Review not found");
    }
    if (review.userId !== userId) {
        throw new apiAppError_1.ApiAppError(403, "Access denied");
    }
    await prisma_client_1.prismaC.review.delete({
        where: { id: reviewId },
    });
    return { message: "Review deleted successfully" };
};
/**
 * Get Reviews by Product
 */
const getProductReviews = async (productId) => {
    return prisma_client_1.prismaC.review.findMany({
        where: {
            productId,
        },
        orderBy: {
            createdAt: "desc",
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });
};
exports.reviewServices = {
    createReview,
    updateReview,
    deleteReview,
    getProductReviews,
};
