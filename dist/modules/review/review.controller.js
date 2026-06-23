"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewControllers = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const review_service_1 = require("./review.service");
const createReview = (0, catchAsync_1.default)(async (req, res) => {
    const { userId, productId, rating, comment } = req.body;
    const result = await review_service_1.reviewServices.createReview({
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
const updateReview = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const { userId, payload } = req.body;
    const result = await review_service_1.reviewServices.updateReview(id, userId, payload);
    res.status(200).json({
        success: true,
        message: "Review updated successfully",
        data: result,
    });
});
const deleteReview = (0, catchAsync_1.default)(async (req, res) => {
    const { userId } = req.body;
    const { id } = req.params;
    const result = await review_service_1.reviewServices.deleteReview(id, userId);
    res.status(200).json({
        success: true,
        message: result.message,
    });
});
const getProductReviews = (0, catchAsync_1.default)(async (req, res) => {
    const { productId } = req.params;
    const result = await review_service_1.reviewServices.getProductReviews(productId);
    res.status(200).json({
        success: true,
        message: "Reviews fetched successfully",
        data: result,
    });
});
exports.reviewControllers = {
    createReview,
    updateReview,
    deleteReview,
    getProductReviews,
};
