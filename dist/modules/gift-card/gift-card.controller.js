"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCardControllers = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const gift_card_service_1 = require("./gift-card.service");
const getGiftCards = (0, catchAsync_1.default)(async (req, res) => {
    const result = await gift_card_service_1.giftCardServices.getGiftCards(req.query);
    res.status(200).json({
        success: true,
        message: "Gift cards fetched successfully",
        data: result,
    });
});
const getGiftCardById = (0, catchAsync_1.default)(async (req, res) => {
    const result = await gift_card_service_1.giftCardServices.getGiftCardById(req.params.id);
    res.status(200).json({
        success: true,
        message: "Gift card fetched successfully",
        data: result,
    });
});
const createGiftCard = (0, catchAsync_1.default)(async (req, res) => {
    const result = await gift_card_service_1.giftCardServices.createGiftCard(req.body, req.authUser?.id);
    res.status(201).json({
        success: true,
        message: "Gift card created successfully",
        data: result,
    });
});
const updateGiftCard = (0, catchAsync_1.default)(async (req, res) => {
    const result = await gift_card_service_1.giftCardServices.updateGiftCard(req.params.id, req.body, req.authUser?.id);
    res.status(200).json({
        success: true,
        message: "Gift card updated successfully",
        data: result,
    });
});
const deleteGiftCard = (0, catchAsync_1.default)(async (req, res) => {
    const result = await gift_card_service_1.giftCardServices.deleteGiftCard(req.params.id);
    res.status(200).json({
        success: true,
        message: "Gift card deleted successfully",
        data: result,
    });
});
exports.giftCardControllers = {
    getGiftCards,
    getGiftCardById,
    createGiftCard,
    updateGiftCard,
    deleteGiftCard,
};
