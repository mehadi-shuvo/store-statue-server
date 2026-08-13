import {
  DigitalProductType,
  ProductStatus,
} from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";

const resolveProduct = async (
  productId: string,
  requestedType?: DigitalProductType,
) => {
  if (!productId) throw new ApiAppError(400, "productId is required");

  const [giftCard, gameTopUp, subscription] = await Promise.all([
    !requestedType || requestedType === DigitalProductType.GIFT_CARD
      ? prismaC.giftCardProduct.findFirst({
          where: { id: productId, status: ProductStatus.ACTIVE, deletedAt: null },
          select: { id: true },
        })
      : null,
    !requestedType || requestedType === DigitalProductType.GAME_TOP_UP
      ? prismaC.gameTopUpProduct.findFirst({
          where: { id: productId, status: ProductStatus.ACTIVE, deletedAt: null },
          select: { id: true },
        })
      : null,
    !requestedType || requestedType === DigitalProductType.SUBSCRIPTION
      ? prismaC.subscriptionProduct.findFirst({
          where: { id: productId, status: ProductStatus.ACTIVE, deletedAt: null },
          select: { id: true },
        })
      : null,
  ]);

  const matches = [
    giftCard && DigitalProductType.GIFT_CARD,
    gameTopUp && DigitalProductType.GAME_TOP_UP,
    subscription && DigitalProductType.SUBSCRIPTION,
  ].filter((value): value is DigitalProductType => Boolean(value));

  if (matches.length === 0) throw new ApiAppError(404, "Product not found");
  if (matches.length > 1) {
    throw new ApiAppError(409, "productType is required for this product id");
  }
  return matches[0];
};

const findExistingReview = (
  userId: string,
  productId: string,
  productType: DigitalProductType,
) => {
  if (productType === DigitalProductType.GIFT_CARD) {
    return prismaC.review.findUnique({
      where: { userId_giftCardProductId: { userId, giftCardProductId: productId } },
    });
  }
  if (productType === DigitalProductType.GAME_TOP_UP) {
    return prismaC.review.findUnique({
      where: { userId_gameTopUpProductId: { userId, gameTopUpProductId: productId } },
    });
  }
  return prismaC.review.findUnique({
    where: {
      userId_subscriptionProductId: { userId, subscriptionProductId: productId },
    },
  });
};

const createReview = async (payload: {
  userId: string;
  productId: string;
  productType?: DigitalProductType;
  rating: number;
  comment?: string;
}) => {
  const { userId, productId, rating, comment } = payload;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiAppError(400, "Rating must be an integer between 1 and 5");
  }

  const productType = await resolveProduct(productId, payload.productType);
  if (await findExistingReview(userId, productId, productType)) {
    throw new ApiAppError(409, "You have already reviewed this product");
  }

  return prismaC.review.create({
    data: {
      userId,
      productType,
      rating,
      comment,
      ...(productType === DigitalProductType.GIFT_CARD
        ? { giftCardProductId: productId }
        : productType === DigitalProductType.GAME_TOP_UP
          ? { gameTopUpProductId: productId }
          : { subscriptionProductId: productId }),
    },
  });
};

const updateReview = async (
  reviewId: string,
  userId: string,
  payload: { rating?: number; comment?: string },
) => {
  const review = await prismaC.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new ApiAppError(404, "Review not found");
  if (review.userId !== userId) throw new ApiAppError(403, "Access denied");

  if (
    payload.rating !== undefined &&
    (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5)
  ) {
    throw new ApiAppError(400, "Rating must be an integer between 1 and 5");
  }
  if (payload.rating === undefined && payload.comment === undefined) {
    throw new ApiAppError(400, "At least one review field is required");
  }

  return prismaC.review.update({ where: { id: reviewId }, data: payload });
};

const deleteReview = async (reviewId: string, userId: string) => {
  const review = await prismaC.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new ApiAppError(404, "Review not found");
  if (review.userId !== userId) throw new ApiAppError(403, "Access denied");

  await prismaC.review.delete({ where: { id: reviewId } });
  return { message: "Review deleted successfully" };
};

const getProductReviews = async (productId: string) => {
  if (!productId) throw new ApiAppError(400, "productId is required");

  return prismaC.review.findMany({
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

export const reviewServices = {
  createReview,
  updateReview,
  deleteReview,
  getProductReviews,
};
