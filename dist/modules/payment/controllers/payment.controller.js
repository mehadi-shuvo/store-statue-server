"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentController = void 0;
const apiAppError_1 = require("../../../utils/apiAppError");
const catchAsync_1 = __importDefault(require("../../../utils/catchAsync"));
const payment_service_factory_1 = require("../services/payment-service.factory");
const getAuthUserId = (userId) => {
    if (!userId) {
        throw new apiAppError_1.ApiAppError(401, "Authentication token is required");
    }
    return userId;
};
const createPayment = (0, catchAsync_1.default)(async (req, res) => {
    const result = await payment_service_factory_1.paymentService.createPayment(req.body, getAuthUserId(req.authUser?.id));
    res.status(201).json({
        success: true,
        message: "Payment created successfully",
        data: result,
    });
});
const executePayment = (0, catchAsync_1.default)(async (req, res) => {
    const result = await payment_service_factory_1.paymentService.executePayment(req.body.paymentId, getAuthUserId(req.authUser?.id), req.query);
    res.status(200).json({
        success: true,
        message: "Payment executed successfully",
        data: result,
    });
});
const getPaymentStatus = (0, catchAsync_1.default)(async (req, res) => {
    const result = await payment_service_factory_1.paymentService.getPaymentStatus(req.params.paymentId, getAuthUserId(req.authUser?.id));
    res.status(200).json({
        success: true,
        message: "Payment status fetched successfully",
        data: result,
    });
});
exports.paymentController = {
    createPayment,
    executePayment,
    getPaymentStatus,
};
