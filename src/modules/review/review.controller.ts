import catchAsync from "../../utils/catchAsync";
import { reviewServices } from "./review.service";

const createReview = catchAsync(async (req, res) => {
  const { userId, productId, rating, comment } = req.body;

  const result = await reviewServices.createReview({
    userId,
    productId,
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
  const { userId, payload } = req.body;

  const result = await reviewServices.updateReview(id, userId, payload);

  res.status(200).json({
    success: true,
    message: "Review updated successfully",
    data: result,
  });
});

const deleteReview = catchAsync(async (req, res) => {
  const { userId } = req.body;
  const { id } = req.params;

  const result = await reviewServices.deleteReview(id, userId);

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
