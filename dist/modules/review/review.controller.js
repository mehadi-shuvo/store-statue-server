"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewControllers = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const apiAppError_1 = require("../../utils/apiAppError");
const review_service_1 = require("./review.service");
const getAuthenticatedUserId = (req) => {
    if (!req.authUser?.id) {
        throw new apiAppError_1.ApiAppError(401, "Authentication token is required");
    }
    return req.authUser.id;
};
const createReview = (0, catchAsync_1.default)(async (req, res) => {
    const { productId, productType, rating, comment } = req.body;
    const result = await review_service_1.reviewServices.createReview({
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
const updateReview = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const payload = req.body.payload ?? req.body;
    const result = await review_service_1.reviewServices.updateReview(id, getAuthenticatedUserId(req), payload);
    res.status(200).json({
        success: true,
        message: "Review updated successfully",
        data: result,
    });
});
const deleteReview = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await review_service_1.reviewServices.deleteReview(id, getAuthenticatedUserId(req));
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
