"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionControllers = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const subscription_service_1 = require("./subscription.service");
const getSubscriptions = (0, catchAsync_1.default)(async (req, res) => {
    const result = await subscription_service_1.subscriptionServices.getSubscriptions(req.query);
    res.status(200).json({
        success: true,
        message: "Subscription products fetched successfully",
        data: result,
    });
});
const getSubscriptionById = (0, catchAsync_1.default)(async (req, res) => {
    const result = await subscription_service_1.subscriptionServices.getSubscriptionById(req.params.id);
    res.status(200).json({
        success: true,
        message: "Subscription product fetched successfully",
        data: result,
    });
});
const createSubscription = (0, catchAsync_1.default)(async (req, res) => {
    const result = await subscription_service_1.subscriptionServices.createSubscription(req.body, req.authUser?.id);
    res.status(201).json({
        success: true,
        message: "Subscription product created successfully",
        data: result,
    });
});
const updateSubscription = (0, catchAsync_1.default)(async (req, res) => {
    const result = await subscription_service_1.subscriptionServices.updateSubscription(req.params.id, req.body, req.authUser?.id);
    res.status(200).json({
        success: true,
        message: "Subscription product updated successfully",
        data: result,
    });
});
const deleteSubscription = (0, catchAsync_1.default)(async (req, res) => {
    const result = await subscription_service_1.subscriptionServices.deleteSubscription(req.params.id);
    res.status(200).json({
        success: true,
        message: "Subscription product deleted successfully",
        data: result,
    });
});
exports.subscriptionControllers = {
    getSubscriptions,
    getSubscriptionById,
    createSubscription,
    updateSubscription,
    deleteSubscription,
};
