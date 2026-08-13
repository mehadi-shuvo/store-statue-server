import { Router } from "express";
import { UserRole } from "../../generated/prisma/client";
import { authenticateUser, authorizeRoles, requireAdmin } from "../../middlewares/auth.middleware";
import { adminRateLimiter } from "../../middlewares/rate-limit.middleware";
import { adminController } from "./admin.controller";

const router = Router();

router.use(authenticateUser);
router.use(adminRateLimiter);

router.get("/profile", requireAdmin, adminController.getOwnProfile);
router.patch("/profile", requireAdmin, adminController.updateOwnProfile);
router.patch("/profile/password", requireAdmin, adminController.changeOwnPassword);

router.get("/users", requireAdmin, adminController.getUsers);
router.get("/users/:userId", requireAdmin, adminController.getUserById);
router.patch("/users/:userId/status", requireAdmin, adminController.updateUserStatus);
router.post(
  "/users/:userId/resolve-issue",
  requireAdmin,
  adminController.resolveCustomerIssue,
);

router.get("/orders", requireAdmin, adminController.getOrders);
router.get("/orders/:orderId", requireAdmin, adminController.getOrderById);
router.patch(
  "/orders/:orderId/status",
  requireAdmin,
  adminController.updateOrderStatus,
);

router.get("/delivery/items", requireAdmin, adminController.getDeliveryItems);
router.patch(
  "/delivery/items/:orderItemId",
  requireAdmin,
  adminController.updateDeliveryStatus,
);

router.get("/payments", requireAdmin, adminController.getPayments);
router.get("/payments/:paymentId", requireAdmin, adminController.getPaymentById);
router.patch(
  "/payments/:paymentId/verify",
  requireAdmin,
  adminController.verifyPaymentIssue,
);

router.get(
  "/digital-products",
  requireAdmin,
  adminController.getDigitalProducts,
);
router.get(
  "/digital-products/overview",
  requireAdmin,
  adminController.getDigitalProductOverview,
);
router.get("/stats/sales", requireAdmin, adminController.getSalesStats);
router.get("/audit-logs", requireAdmin, adminController.getAuditLogs);
router.get("/logs", requireAdmin, adminController.getLogs);

router.post(
  "/",
  authorizeRoles(UserRole.SUPER_ADMIN),
  adminController.createAdmin,
);
router.get("/", requireAdmin, adminController.getAdmins);
router.get("/:adminId", requireAdmin, adminController.getAdminById);
router.patch(
  "/:adminId",
  authorizeRoles(UserRole.SUPER_ADMIN),
  adminController.updateAdminById,
);
router.patch(
  "/:adminId/deactivate",
  authorizeRoles(UserRole.SUPER_ADMIN),
  adminController.deactivateAdmin,
);
router.patch(
  "/:adminId/restore",
  authorizeRoles(UserRole.SUPER_ADMIN),
  adminController.restoreAdmin,
);

export const adminRouter = router;
