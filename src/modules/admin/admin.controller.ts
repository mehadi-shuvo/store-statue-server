import { UserRole } from "../../generated/prisma/client";
import catchAsync from "../../utils/catchAsync";
import { adminService } from "./admin.service";
import {
  adminUserQuerySchema,
  changeAdminPasswordSchema,
  createAdminSchema,
  dateRangeQuerySchema,
  deliveryQuerySchema,
  digitalProductQuerySchema,
  logQuerySchema,
  manageAdminProfileSchema,
  orderQuerySchema,
  parseRequestQuery,
  paymentQuerySchema,
  parseRequestBody,
  resolveCustomerIssueSchema,
  updateDeliveryStatusSchema,
  updateAdminProfileSchema,
  updateOrderStatusSchema,
  updateUserStatusSchema,
  verifyPaymentIssueSchema,
  verifyAdminActionSchema,
} from "./admin.validation";
import { readLatestLogs } from "../../utils/log-reader";

const createAdmin = catchAsync(async (req, res) => {
  const payload = parseRequestBody(createAdminSchema, req.body);
  const admin = await adminService.createAdmin(req.authUser!.id, payload);

  res.status(201).json({
    success: true,
    message: "Admin profile created successfully",
    data: admin,
  });
});

const getAdmins = catchAsync(async (req, res) => {
  const includeInactive =
    req.authUser?.role === UserRole.SUPER_ADMIN &&
    req.query.includeInactive === "true";
  const admins = await adminService.getAdmins(includeInactive);

  res.status(200).json({
    success: true,
    message: "Admin profiles retrieved successfully",
    data: admins,
  });
});

const getAdminById = catchAsync(async (req, res) => {
  const admin = await adminService.getAdminById(req.params.adminId);

  res.status(200).json({
    success: true,
    message: "Admin profile retrieved successfully",
    data: admin,
  });
});

const getOwnProfile = catchAsync(async (req, res) => {
  const admin = await adminService.getOwnProfile(req.authUser!.id);

  res.status(200).json({
    success: true,
    message: "Admin profile retrieved successfully",
    data: admin,
  });
});

const updateOwnProfile = catchAsync(async (req, res) => {
  const payload = parseRequestBody(updateAdminProfileSchema, req.body);
  const admin = await adminService.updateOwnProfile(req.authUser!.id, payload);

  res.status(200).json({
    success: true,
    message: "Admin profile updated successfully",
    data: admin,
  });
});

const updateAdminById = catchAsync(async (req, res) => {
  const payload = parseRequestBody(manageAdminProfileSchema, req.body);
  const admin = await adminService.updateAdminById(
    req.authUser!.id,
    req.params.adminId,
    payload,
  );

  res.status(200).json({
    success: true,
    message: "Admin profile updated successfully",
    data: admin,
  });
});

const changeOwnPassword = catchAsync(async (req, res) => {
  const payload = parseRequestBody(changeAdminPasswordSchema, req.body);

  await adminService.changeOwnPassword(req.authUser!.id, payload);

  res.status(200).json({
    success: true,
    message: "Admin password changed successfully",
  });
});

const deactivateAdmin = catchAsync(async (req, res) => {
  const payload = parseRequestBody(verifyAdminActionSchema, req.body);
  const admin = await adminService.deactivateAdmin(
    req.authUser!.id,
    req.params.adminId,
    payload,
  );

  res.status(200).json({
    success: true,
    message: "Admin profile deactivated successfully",
    data: admin,
  });
});

const restoreAdmin = catchAsync(async (req, res) => {
  const payload = parseRequestBody(verifyAdminActionSchema, req.body);
  const admin = await adminService.restoreAdmin(
    req.authUser!.id,
    req.params.adminId,
    payload,
  );

  res.status(200).json({
    success: true,
    message: "Admin profile restored successfully",
    data: admin,
  });
});

const getUsers = catchAsync(async (req, res) => {
  const query = parseRequestQuery(adminUserQuerySchema, req.query);
  const users = await adminService.getUsers(query);

  res.status(200).json({
    success: true,
    message: "Users retrieved successfully",
    data: users,
  });
});

const getUserById = catchAsync(async (req, res) => {
  const user = await adminService.getUserById(req.params.userId);

  res.status(200).json({
    success: true,
    message: "User retrieved successfully",
    data: user,
  });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const payload = parseRequestBody(updateUserStatusSchema, req.body);
  const user = await adminService.updateUserStatus(
    req.authUser!.id,
    req.params.userId,
    payload,
  );

  res.status(200).json({
    success: true,
    message: "User status updated successfully",
    data: user,
  });
});

const resolveCustomerIssue = catchAsync(async (req, res) => {
  const payload = parseRequestBody(resolveCustomerIssueSchema, req.body);

  await adminService.resolveCustomerIssue(
    req.authUser!.id,
    req.params.userId,
    payload,
  );

  res.status(200).json({
    success: true,
    message: "Customer account issue recorded as resolved",
  });
});

const getOrders = catchAsync(async (req, res) => {
  const query = parseRequestQuery(orderQuerySchema, req.query);
  const orders = await adminService.getOrders(query);

  res.status(200).json({
    success: true,
    message: "Orders retrieved successfully",
    data: orders,
  });
});

const getOrderById = catchAsync(async (req, res) => {
  const order = await adminService.getOrderById(req.params.orderId);

  res.status(200).json({
    success: true,
    message: "Order retrieved successfully",
    data: order,
  });
});

const updateOrderStatus = catchAsync(async (req, res) => {
  const payload = parseRequestBody(updateOrderStatusSchema, req.body);
  const order = await adminService.updateOrderStatus(
    req.authUser!.id,
    req.params.orderId,
    payload,
  );

  res.status(200).json({
    success: true,
    message: "Order status updated successfully",
    data: order,
  });
});

const getDeliveryItems = catchAsync(async (req, res) => {
  const query = parseRequestQuery(deliveryQuerySchema, req.query);
  const deliveryItems = await adminService.getDeliveryItems(query);

  res.status(200).json({
    success: true,
    message: "Delivery items retrieved successfully",
    data: deliveryItems,
  });
});

const updateDeliveryStatus = catchAsync(async (req, res) => {
  const payload = parseRequestBody(updateDeliveryStatusSchema, req.body);
  const deliveryItem = await adminService.updateDeliveryStatus(
    req.authUser!.id,
    req.params.orderItemId,
    payload,
  );

  res.status(200).json({
    success: true,
    message: "Delivery status updated successfully",
    data: deliveryItem,
  });
});

const getPayments = catchAsync(async (req, res) => {
  const query = parseRequestQuery(paymentQuerySchema, req.query);
  const payments = await adminService.getPayments(query);

  res.status(200).json({
    success: true,
    message: "Payments retrieved successfully",
    data: payments,
  });
});

const getPaymentById = catchAsync(async (req, res) => {
  const payment = await adminService.getPaymentById(req.params.paymentId);

  res.status(200).json({
    success: true,
    message: "Payment retrieved successfully",
    data: payment,
  });
});

const verifyPaymentIssue = catchAsync(async (req, res) => {
  const payload = parseRequestBody(verifyPaymentIssueSchema, req.body);
  const payment = await adminService.verifyPaymentIssue(
    req.authUser!.id,
    req.params.paymentId,
    payload,
  );

  res.status(200).json({
    success: true,
    message: "Payment issue verified successfully",
    data: payment,
  });
});

const getDigitalProductOverview = catchAsync(async (req, res) => {
  const overview = await adminService.getDigitalProductOverview();

  res.status(200).json({
    success: true,
    message: "Digital product overview retrieved successfully",
    data: overview,
  });
});

const getDigitalProducts = catchAsync(async (req, res) => {
  const query = parseRequestQuery(digitalProductQuerySchema, req.query);
  const products = await adminService.getDigitalProducts(query);

  res.status(200).json({
    success: true,
    message: "Digital products retrieved successfully",
    data: products,
  });
});

const getSalesStats = catchAsync(async (req, res) => {
  const query = parseRequestQuery(dateRangeQuerySchema, req.query);
  const stats = await adminService.getSalesStats(query);

  res.status(200).json({
    success: true,
    message: "Sales statistics retrieved successfully",
    data: stats,
  });
});

const getAuditLogs = catchAsync(async (req, res) => {
  const logs = await adminService.getAuditLogs();

  res.status(200).json({
    success: true,
    message: "Admin audit logs retrieved successfully",
    data: logs,
  });
});

const getLogs = catchAsync(async (req, res) => {
  const query = parseRequestQuery(logQuerySchema, req.query);
  const logs = await readLatestLogs(query);

  res.status(200).json({
    success: true,
    message: "Application logs retrieved successfully",
    data: logs,
  });
});

export const adminController = {
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
