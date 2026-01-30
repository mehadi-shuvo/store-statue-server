import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";

/**
 * Create Review
 */
const createReview = async (payload: {
  userId: string;
  productId: string;
  rating: number;
  comment?: string;
}) => {
  const { userId, productId, rating, comment } = payload;

  // Rating validation
  if (rating < 1 || rating > 5) {
    throw new ApiAppError(400, "Rating must be between 1 and 5");
  }

  // Product validation
  const product = await prismaC.product.findFirst({
    where: {
      id: productId,
      isActive: true,
    },
  });

  if (!product) {
    throw new ApiAppError(404, "Product not found");
  }

  // Duplicate review check
  const existingReview = await prismaC.review.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  if (existingReview) {
    throw new ApiAppError(409, "You have already reviewed this product");
  }

  return prismaC.review.create({
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
const updateReview = async (
  reviewId: string,
  userId: string,
  payload: {
    rating?: number;
    comment?: string;
  },
) => {
  const review = await prismaC.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new ApiAppError(404, "Review not found");
  }

  if (review.userId !== userId) {
    throw new ApiAppError(403, "Access denied");
  }

  if (payload.rating && (payload.rating < 1 || payload.rating > 5)) {
    throw new ApiAppError(400, "Rating must be between 1 and 5");
  }

  return prismaC.review.update({
    where: { id: reviewId },
    data: payload,
  });
};

/**
 * Delete Review (Only Owner)
 */
const deleteReview = async (reviewId: string, userId: string) => {
  const review = await prismaC.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new ApiAppError(404, "Review not found");
  }

  if (review.userId !== userId) {
    throw new ApiAppError(403, "Access denied");
  }

  await prismaC.review.delete({
    where: { id: reviewId },
  });

  return { message: "Review deleted successfully" };
};

/**
 * Get Reviews by Product
 */
const getProductReviews = async (productId: string) => {
  return prismaC.review.findMany({
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

export const reviewServices = {
  createReview,
  updateReview,
  deleteReview,
  getProductReviews,
};
