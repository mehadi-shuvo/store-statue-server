"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartControllers = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const cart_service_1 = require("./cart.service");
const addToCart = (0, catchAsync_1.default)(async (req, res) => {
    const result = await cart_service_1.cartServices.addToCart(req.body);
    res.status(200).json({
        success: true,
        message: "Product added to cart",
        data: result,
    });
});
const updateCartItem = (0, catchAsync_1.default)(async (req, res) => {
    const result = await cart_service_1.cartServices.updateCartItem(req.body);
    res.status(200).json({
        success: true,
        message: "Cart item updated",
        data: result,
    });
});
const removeFromCart = (0, catchAsync_1.default)(async (req, res) => {
    const result = await cart_service_1.cartServices.removeFromCart(req.body);
    res.status(200).json({
        success: true,
        message: "Item removed from cart",
        data: result,
    });
});
const getCart = (0, catchAsync_1.default)(async (req, res) => {
    const { userId } = req.params;
    const result = await cart_service_1.cartServices.getCart(userId);
    res.status(200).json({
        success: true,
        message: "Cart fetched successfully",
        data: result,
    });
});
const clearCart = (0, catchAsync_1.default)(async (req, res) => {
    const { userId } = req.params;
    const result = await cart_service_1.cartServices.clearCart(userId);
    res.status(200).json({
        success: true,
        message: "Cart cleared successfully",
        data: result,
    });
});
exports.cartControllers = {
    addToCart,
    updateCartItem,
    removeFromCart,
    getCart,
    clearCart,
};
