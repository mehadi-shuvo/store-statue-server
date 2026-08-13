"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = void 0;
const client_1 = require("../../generated/prisma/client");
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const admin_service_1 = require("./admin.service");
const admin_validation_1 = require("./admin.validation");
const log_reader_1 = require("../../utils/log-reader");
const createAdmin = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, admin_validation_1.parseRequestBody)(admin_validation_1.createAdminSchema, req.body);
    const admin = await admin_service_1.adminService.createAdmin(req.authUser.id, payload);
    res.status(201).json({
        success: true,
        message: "Admin profile created successfully",
        data: admin,
    });
});
const getAdmins = (0, catchAsync_1.default)(async (req, res) => {
    const includeInactive = req.authUser?.role === client_1.UserRole.SUPER_ADMIN &&
        req.query.includeInactive === "true";
    const admins = await admin_service_1.adminService.getAdmins(includeInactive);
    res.status(200).json({
        success: true,
        message: "Admin profiles retrieved successfully",
        data: admins,
    });
});
const getAdminById = (0, catchAsync_1.default)(async (req, res) => {
    const admin = await admin_service_1.adminService.getAdminById(req.params.adminId);
    res.status(200).json({
        success: true,
        message: "Admin profile retrieved successfully",
        data: admin,
    });
});
const getOwnProfile = (0, catchAsync_1.default)(async (req, res) => {
    const admin = await admin_service_1.adminService.getOwnProfile(req.authUser.id);
    res.status(200).json({
        success: true,
        message: "Admin profile retrieved successfully",
        data: admin,
    });
});
const updateOwnProfile = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, admin_validation_1.parseRequestBody)(admin_validation_1.updateAdminProfileSchema, req.body);
    const admin = await admin_service_1.adminService.updateOwnProfile(req.authUser.id, payload);
    res.status(200).json({
        success: true,
        message: "Admin profile updated successfully",
        data: admin,
    });
});
const updateAdminById = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, admin_validation_1.parseRequestBody)(admin_validation_1.manageAdminProfileSchema, req.body);
    const admin = await admin_service_1.adminService.updateAdminById(req.authUser.id, req.params.adminId, payload);
    res.status(200).json({
        success: true,
        message: "Admin profile updated successfully",
        data: admin,
    });
});
const changeOwnPassword = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, admin_validation_1.parseRequestBody)(admin_validation_1.changeAdminPasswordSchema, req.body);
    await admin_service_1.adminService.changeOwnPassword(req.authUser.id, payload);
    res.status(200).json({
        success: true,
        message: "Admin password changed successfully",
    });
});
const deactivateAdmin = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, admin_validation_1.parseRequestBody)(admin_validation_1.verifyAdminActionSchema, req.body);
    const admin = await admin_service_1.adminService.deactivateAdmin(req.authUser.id, req.params.adminId, payload);
    res.status(200).json({
        success: true,
        message: "Admin profile deactivated successfully",
        data: admin,
    });
});
const restoreAdmin = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, admin_validation_1.parseRequestBody)(admin_validation_1.verifyAdminActionSchema, req.body);
    const admin = await admin_service_1.adminService.restoreAdmin(req.authUser.id, req.params.adminId, payload);
    res.status(200).json({
        success: true,
        message: "Admin profile restored successfully",
        data: admin,
    });
});
const getUsers = (0, catchAsync_1.default)(async (req, res) => {
    const query = (0, admin_validation_1.parseRequestQuery)(admin_validation_1.adminUserQuerySchema, req.query);
    const users = await admin_service_1.adminService.getUsers(query);
    res.status(200).json({
        success: true,
        message: "Users retrieved successfully",
        data: users,
    });
});
const getUserById = (0, catchAsync_1.default)(async (req, res) => {
    const user = await admin_service_1.adminService.getUserById(req.params.userId);
    res.status(200).json({
        success: true,
        message: "User retrieved successfully",
        data: user,
    });
});
const updateUserStatus = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, admin_validation_1.parseRequestBody)(admin_validation_1.updateUserStatusSchema, req.body);
    const user = await admin_service_1.adminService.updateUserStatus(req.authUser.id, req.params.userId, payload);
    res.status(200).json({
        success: true,
        message: "User status updated successfully",
        data: user,
    });
});
const resolveCustomerIssue = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, admin_validation_1.parseRequestBody)(admin_validation_1.resolveCustomerIssueSchema, req.body);
    await admin_service_1.adminService.resolveCustomerIssue(req.authUser.id, req.params.userId, payload);
    res.status(200).json({
        success: true,
        message: "Customer account issue recorded as resolved",
    });
});
const getOrders = (0, catchAsync_1.default)(async (req, res) => {
    const query = (0, admin_validation_1.parseRequestQuery)(admin_validation_1.orderQuerySchema, req.query);
    const orders = await admin_service_1.adminService.getOrders(query);
    res.status(200).json({
        success: true,
        message: "Orders retrieved successfully",
        data: orders,
    });
});
const getOrderById = (0, catchAsync_1.default)(async (req, res) => {
    const order = await admin_service_1.adminService.getOrderById(req.params.orderId);
    res.status(200).json({
        success: true,
        message: "Order retrieved successfully",
        data: order,
    });
});
const updateOrderStatus = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, admin_validation_1.parseRequestBody)(admin_validation_1.updateOrderStatusSchema, req.body);
    const order = await admin_service_1.adminService.updateOrderStatus(req.authUser.id, req.params.orderId, payload);
    res.status(200).json({
        success: true,
        message: "Order status updated successfully",
        data: order,
    });
});
const getDeliveryItems = (0, catchAsync_1.default)(async (req, res) => {
    const query = (0, admin_validation_1.parseRequestQuery)(admin_validation_1.deliveryQuerySchema, req.query);
    const deliveryItems = await admin_service_1.adminService.getDeliveryItems(query);
    res.status(200).json({
        success: true,
        message: "Delivery items retrieved successfully",
        data: deliveryItems,
    });
});
const updateDeliveryStatus = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, admin_validation_1.parseRequestBody)(admin_validation_1.updateDeliveryStatusSchema, req.body);
    const deliveryItem = await admin_service_1.adminService.updateDeliveryStatus(req.authUser.id, req.params.orderItemId, payload);
    res.status(200).json({
        success: true,
        message: "Delivery status updated successfully",
        data: deliveryItem,
    });
});
const getPayments = (0, catchAsync_1.default)(async (req, res) => {
    const query = (0, admin_validation_1.parseRequestQuery)(admin_validation_1.paymentQuerySchema, req.query);
    const payments = await admin_service_1.adminService.getPayments(query);
    res.status(200).json({
        success: true,
        message: "Payments retrieved successfully",
        data: payments,
    });
});
const getPaymentById = (0, catchAsync_1.default)(async (req, res) => {
    const payment = await admin_service_1.adminService.getPaymentById(req.params.paymentId);
    res.status(200).json({
        success: true,
        message: "Payment retrieved successfully",
        data: payment,
    });
});
const verifyPaymentIssue = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, admin_validation_1.parseRequestBody)(admin_validation_1.verifyPaymentIssueSchema, req.body);
    const payment = await admin_service_1.adminService.verifyPaymentIssue(req.authUser.id, req.params.paymentId, payload);
    res.status(200).json({
        success: true,
        message: "Payment issue verified successfully",
        data: payment,
    });
});
const getDigitalProductOverview = (0, catchAsync_1.default)(async (req, res) => {
    const overview = await admin_service_1.adminService.getDigitalProductOverview();
    res.status(200).json({
        success: true,
        message: "Digital product overview retrieved successfully",
        data: overview,
    });
});
const getDigitalProducts = (0, catchAsync_1.default)(async (req, res) => {
    const query = (0, admin_validation_1.parseRequestQuery)(admin_validation_1.digitalProductQuerySchema, req.query);
    const products = await admin_service_1.adminService.getDigitalProducts(query);
    res.status(200).json({
        success: true,
        message: "Digital products retrieved successfully",
        data: products,
    });
});
const getSalesStats = (0, catchAsync_1.default)(async (req, res) => {
    const query = (0, admin_validation_1.parseRequestQuery)(admin_validation_1.dateRangeQuerySchema, req.query);
    const stats = await admin_service_1.adminService.getSalesStats(query);
    res.status(200).json({
        success: true,
        message: "Sales statistics retrieved successfully",
        data: stats,
    });
});
const getAuditLogs = (0, catchAsync_1.default)(async (req, res) => {
    const logs = await admin_service_1.adminService.getAuditLogs();
    res.status(200).json({
        success: true,
        message: "Admin audit logs retrieved successfully",
        data: logs,
    });
});
const getLogs = (0, catchAsync_1.default)(async (req, res) => {
    const query = (0, admin_validation_1.parseRequestQuery)(admin_validation_1.logQuerySchema, req.query);
    const logs = await (0, log_reader_1.readLatestLogs)(query);
    res.status(200).json({
        success: true,
        message: "Application logs retrieved successfully",
        data: logs,
    });
});
exports.adminController = {
    createAdmin,
    getAdmins,
    getAdminById,
    getOwnProfile,
    updateOwnProfile,
    updateAdminById,
    changeOwnPassword,
    deactivateAdmin,
    restoreAdmin,
    getUsers,
    getUserById,
    updateUserStatus,
    resolveCustomerIssue,
    getOrders,
    getOrderById,
    updateOrderStatus,
    getDeliveryItems,
    updateDeliveryStatus,
    getPayments,
    getPaymentById,
    verifyPaymentIssue,
    getDigitalProducts,
    getDigitalProductOverview,
    getSalesStats,
    getAuditLogs,
    getLogs,
};
