"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameTopUpControllers = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const game_top_up_service_1 = require("./game-top-up.service");
const getTopUps = (0, catchAsync_1.default)(async (req, res) => {
    const result = await game_top_up_service_1.gameTopUpServices.getTopUps(req.query);
    res.status(200).json({
        success: true,
        message: "Top-up products fetched successfully",
        data: result,
    });
});
const getTopUpById = (0, catchAsync_1.default)(async (req, res) => {
    const result = await game_top_up_service_1.gameTopUpServices.getTopUpById(req.params.id);
    res.status(200).json({
        success: true,
        message: "Top-up product fetched successfully",
        data: result,
    });
});
const createTopUp = (0, catchAsync_1.default)(async (req, res) => {
    const result = await game_top_up_service_1.gameTopUpServices.createTopUp(req.body, req.authUser?.id);
    res.status(201).json({
        success: true,
        message: "Top-up product created successfully",
        data: result,
    });
});
const updateTopUp = (0, catchAsync_1.default)(async (req, res) => {
    const result = await game_top_up_service_1.gameTopUpServices.updateTopUp(req.params.id, req.body, req.authUser?.id);
    res.status(200).json({
        success: true,
        message: "Top-up product updated successfully",
        data: result,
    });
});
const deleteTopUp = (0, catchAsync_1.default)(async (req, res) => {
    const result = await game_top_up_service_1.gameTopUpServices.deleteTopUp(req.params.id);
    res.status(200).json({
        success: true,
        message: "Top-up product deleted successfully",
        data: result,
    });
});
exports.gameTopUpControllers = {
    getTopUps,
    getTopUpById,
    createTopUp,
    updateTopUp,
    deleteTopUp,
};
