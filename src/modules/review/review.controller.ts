import type { Request } from "express";
import catchAsync from "../../utils/catchAsync";
import { ApiAppError } from "../../utils/apiAppError";
import { reviewServices } from "./review.service";

const getAuthenticatedUserId = (req: Request) => {
  if (!req.authUser?.id) {
    throw new ApiAppError(401, "Authentication token is required");
  }

  return req.authUser.id;
};

const createReview = catchAsync(async (req, res) => {
  const { productId, productType, rating, comment } = req.body;

  const result = await reviewServices.createReview({
    userId: getAuthenticatedUserId(req),
    productId,
    productType,
    rating,
    comment,
  });

  res.status(201).json({
    success: true,
    message: "Review created successfully",
    data: result,
  });
});

const updateReview = catchAsync(async (req, res) => {
  const { id } = req.params;
  const payload = req.body.payload ?? req.body;

  const result = await reviewServices.updateReview(
    id,
    getAuthenticatedUserId(req),
    payload,
  );

  res.status(200).json({
    success: true,
    message: "Review updated successfully",
    data: result,
  });
});

const deleteReview = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await reviewServices.deleteReview(id, getAuthenticatedUserId(req));

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

const getProductReviews = catchAsync(async (req, res) => {
  const { productId } = req.params;

  const result = await reviewServices.getProductReviews(productId);

  res.status(200).json({
    success: true,
    message: "Reviews fetched successfully",
    data: result,
  });
});

export const reviewControllers = {
  createReview,
  updateReview,
  deleteReview,
  getProductReviews,
};
