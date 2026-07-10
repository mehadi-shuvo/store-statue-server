"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rate_limit_middleware_1 = require("../../middlewares/rate-limit.middleware");
const client_1 = require("../../generated/prisma/client");
const user_controller_1 = require("./user.controller");
const router = (0, express_1.Router)();
const signupRateLimiter = (0, rate_limit_middleware_1.createRateLimiter)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many signup attempts. Please try again later.",
    keyPrefix: "signup",
});
const loginRateLimiter = (0, rate_limit_middleware_1.createRateLimiter)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many login attempts. Please try again later.",
    keyPrefix: "login",
});
router.post("/register", signupRateLimiter, user_controller_1.userController.createUser);
router.post("/login", loginRateLimiter, user_controller_1.userController.login);
router.post("/logout", user_controller_1.userController.logout);
router.post("/forgot-password", user_controller_1.userController.forgotPassword);
router.get("/profile", auth_middleware_1.authenticateUser, (0, auth_middleware_1.authorizeRoles)(client_1.UserRole.CUSTOMER), user_controller_1.userController.getCustomerProfile);
router.patch("/profile", auth_middleware_1.authenticateUser, (0, auth_middleware_1.authorizeRoles)(client_1.UserRole.CUSTOMER), user_controller_1.userController.updateCustomerProfile);
router.delete("/profile", auth_middleware_1.authenticateUser, (0, auth_middleware_1.authorizeRoles)(client_1.UserRole.CUSTOMER), user_controller_1.userController.deleteCustomerProfile);
router.get("/", auth_middleware_1.authenticateUser, auth_middleware_1.requireAdmin, user_controller_1.userController.getUsers);
exports.userRouter = router;
