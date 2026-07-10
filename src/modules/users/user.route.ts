import { Router } from "express";
import {
  authenticateUser,
  authorizeRoles,
  requireAdmin,
} from "../../middlewares/auth.middleware";
import { createRateLimiter } from "../../middlewares/rate-limit.middleware";
import { UserRole } from "../../generated/prisma/client";
import { userController } from "./user.controller";

const router = Router();

const signupRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many signup attempts. Please try again later.",
  keyPrefix: "signup",
});

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Please try again later.",
  keyPrefix: "login",
});

router.post("/register", signupRateLimiter, userController.createUser);
router.post("/login", loginRateLimiter, userController.login);
router.post("/logout", userController.logout);
router.post("/forgot-password", userController.forgotPassword);
router.get(
  "/profile",
  authenticateUser,
  authorizeRoles(UserRole.CUSTOMER),
  userController.getCustomerProfile,
);
router.patch(
  "/profile",
  authenticateUser,
  authorizeRoles(UserRole.CUSTOMER),
  userController.updateCustomerProfile,
);
router.delete(
  "/profile",
  authenticateUser,
  authorizeRoles(UserRole.CUSTOMER),
  userController.deleteCustomerProfile,
);
router.get("/", authenticateUser, requireAdmin, userController.getUsers);

export const userRouter = router;
