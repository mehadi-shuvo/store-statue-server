"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCardCommerceController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const cart_service_1 = require("../cart/cart.service");
const gift_card_order_service_1 = require("./gift-card-order.service");
const gift_card_purchase_service_1 = require("./gift-card-purchase.service");
const instantBuy = (0, catchAsync_1.default)(async (req, res) => {
    const data = await gift_card_purchase_service_1.giftCardPurchaseService.instantBuy(req.authUser.id, req.body);
    res.status(201).json({ success: true, message: "Gift card order fulfilled successfully", data });
});
const addCartItem = (0, catchAsync_1.default)(async (req, res) => {
    const data = await cart_service_1.cartServices.addGiftCardItem(req.authUser.id, req.body);
    res.status(201).json({ success: true, message: "Gift card added to cart", data });
});
const updateCartItem = (0, catchAsync_1.default)(async (req, res) => {
    const data = await cart_service_1.cartServices.updateGiftCardItem(req.authUser.id, req.params.cartItemId, req.body.quantity);
    res.status(200).json({ success: true, message: "Cart item updated", data });
});
const removeCartItem = (0, catchAsync_1.default)(async (req, res) => {
    const data = await cart_service_1.cartServices.removeGiftCardItem(req.authUser.id, req.params.cartItemId);
    res.status(200).json({ success: true, message: "Cart item removed", data });
});
const getCart = (0, catchAsync_1.default)(async (req, res) => {
    const data = await cart_service_1.cartServices.getCart(req.authUser.id);
    res.status(200).json({ success: true, message: "Cart fetched successfully", data });
});
const clearCart = (0, catchAsync_1.default)(async (req, res) => {
    const data = await cart_service_1.cartServices.clearCart(req.authUser.id);
    res.status(200).json({ success: true, message: "Cart cleared successfully", data });
});
const checkoutCart = (0, catchAsync_1.default)(async (req, res) => {
    const data = await gift_card_purchase_service_1.giftCardPurchaseService.checkoutCart(req.authUser.id, req.body);
    res.status(201).json({ success: true, message: "Gift card cart fulfilled successfully", data });
});
const listOrders = (0, catchAsync_1.default)(async (req, res) => {
    const data = await gift_card_order_service_1.giftCardOrderService.listForCustomer(req.authUser.id, req.query);
    res.status(200).json({ success: true, message: "Gift card orders fetched successfully", data });
});
const getOrder = (0, catchAsync_1.default)(async (req, res) => {
    const data = await gift_card_order_service_1.giftCardOrderService.getForCustomer(req.authUser.id, req.params.orderId);
    res.status(200).json({ success: true, message: "Gift card order fetched successfully", data });
});
exports.giftCardCommerceController = {
    instantBuy,
    addCartItem,
    updateCartItem,
    removeCartItem,
    getCart,
    clearCart,
    checkoutCart,
    listOrders,
    getOrder,
};
