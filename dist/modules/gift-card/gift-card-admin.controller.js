"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCardAdminController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const gift_card_admin_service_1 = require("./gift-card-admin.service");
const gift_card_order_service_1 = require("./gift-card-order.service");
const response = (res, status, message, data) => res.status(status).json({ success: true, message, data });
const listProducts = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Gift cards fetched successfully", await gift_card_admin_service_1.giftCardAdminService.listProducts(req.query)));
const getProduct = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Gift card fetched successfully", await gift_card_admin_service_1.giftCardAdminService.getProduct(req.params.giftCardId)));
const createProduct = (0, catchAsync_1.default)(async (req, res) => response(res, 201, "Gift card created successfully", await gift_card_admin_service_1.giftCardAdminService.createProduct(req.authUser.id, req.body)));
const updateProduct = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Gift card updated successfully", await gift_card_admin_service_1.giftCardAdminService.updateProduct(req.authUser.id, req.params.giftCardId, req.body)));
const archiveProduct = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Gift card archived successfully", await gift_card_admin_service_1.giftCardAdminService.archiveProduct(req.authUser.id, req.params.giftCardId)));
const createDenomination = (0, catchAsync_1.default)(async (req, res) => response(res, 201, "Denomination created successfully", await gift_card_admin_service_1.giftCardAdminService.createDenomination(req.authUser.id, req.params.giftCardId, req.body)));
const listDenominations = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Denominations fetched successfully", await gift_card_admin_service_1.giftCardAdminService.listDenominations(req.params.giftCardId)));
const updateDenomination = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Denomination updated successfully", await gift_card_admin_service_1.giftCardAdminService.updateDenomination(req.authUser.id, req.params.denominationId, req.body)));
const deleteDenomination = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Denomination removed or deactivated successfully", await gift_card_admin_service_1.giftCardAdminService.deleteDenomination(req.authUser.id, req.params.denominationId)));
const addCode = (0, catchAsync_1.default)(async (req, res) => response(res, 201, "Inventory code added successfully", await gift_card_admin_service_1.giftCardAdminService.addCode(req.authUser.id, req.params.denominationId, req.body)));
const addCodesBulk = (0, catchAsync_1.default)(async (req, res) => response(res, 201, "Inventory codes added successfully", await gift_card_admin_service_1.giftCardAdminService.addCodesBulk(req.authUser.id, req.params.denominationId, req.body.codes)));
const listCodes = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Inventory codes fetched successfully", await gift_card_admin_service_1.giftCardAdminService.listCodes(req.params.denominationId, req.query)));
const getCode = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Inventory code fetched successfully", await gift_card_admin_service_1.giftCardAdminService.getCode(req.params.codeId)));
const updateCode = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Inventory code updated successfully", await gift_card_admin_service_1.giftCardAdminService.updateCode(req.authUser.id, req.params.codeId, req.body)));
const deleteCode = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Inventory code deleted successfully", await gift_card_admin_service_1.giftCardAdminService.deleteCode(req.authUser.id, req.params.codeId)));
const inventorySummary = (0, catchAsync_1.default)(async (_req, res) => response(res, 200, "Inventory summary fetched successfully", await gift_card_admin_service_1.giftCardAdminService.inventorySummary()));
const listOrders = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Gift card orders fetched successfully", await gift_card_order_service_1.giftCardOrderService.listForAdmin(req.query)));
const getOrder = (0, catchAsync_1.default)(async (req, res) => response(res, 200, "Gift card order fetched successfully", await gift_card_order_service_1.giftCardOrderService.getForAdmin(req.params.orderId)));
exports.giftCardAdminController = {
    listProducts, getProduct, createProduct, updateProduct, archiveProduct,
    createDenomination, listDenominations, updateDenomination, deleteDenomination,
    addCode, addCodesBulk, listCodes, getCode, updateCode, deleteCode, inventorySummary,
    listOrders, getOrder,
};
