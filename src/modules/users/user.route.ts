import { Router } from "express";
import {
  authenticateUser,
  authorizeRoles,
  requireAdmin,
} from "../../middlewares/auth.middleware";
import {
  authenticatedUserRateLimiter,
  forgotPasswordRateLimiter,
  loginRateLimiter,
  otpVerifyRateLimiter,
  registerRateLimiter,
} from "../../middlewares/rate-limit.middleware";
import { UserRole } from "../../generated/prisma/client";
import { userController } from "./user.controller";

const router = Router();

router.post("/register", registerRateLimiter, userController.createUser);
router.post("/login", loginRateLimiter, userController.login);
router.post("/logout", userController.logout);
router.post("/forgot-password", forgotPasswordRateLimiter, userController.forgotPassword);
router.post("/reset-password", otpVerifyRateLimiter, userController.resetPassword);
router.get(
  "/profile",
  authenticateUser,
  authenticatedUserRateLimiter,
  authorizeRoles(UserRole.CUSTOMER),
  userController.getCustomerProfile,
);
router.patch(
  "/profile",
  authenticateUser,
  authenticatedUserRateLimiter,
  authorizeRoles(UserRole.CUSTOMER),
  userController.updateCustomerProfile,
);
router.delete(
  "/profile",
  authenticateUser,
  authenticatedUserRateLimiter,
  authorizeRoles(UserRole.CUSTOMER),
  userController.deleteCustomerProfile,
);
router.get("/", authenticateUser, requireAdmin, userController.getUsers);

export const userRouter = router;
