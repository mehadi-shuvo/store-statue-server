"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const env_config_1 = require("../../utils/env-config");
const user_service_1 = require("./user.service");
const user_validation_1 = require("./user.validation");
const ACCESS_TOKEN_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;
const isProduction = env_config_1.ENV.NODE_ENV === "production";
const sameSite = isProduction ? "none" : "lax";
const accessTokenCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
    path: "/",
};
const legacyUserInfoCookieOptions = {
    secure: isProduction,
    sameSite,
    path: "/",
};
const createUser = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, user_validation_1.parseRequestBody)(user_validation_1.createCustomerSchema, req.body);
    const user = await user_service_1.userService.createUser(payload);
    res.status(201).json({
        success: true,
        message: "Account created successfully",
        data: user,
    });
});
const login = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, user_validation_1.parseRequestBody)(user_validation_1.loginSchema, req.body);
    const result = await user_service_1.userService.loginUser(payload);
    res.cookie("accessToken", result.accessToken, accessTokenCookieOptions);
    res.clearCookie("userInfo", legacyUserInfoCookieOptions);
    res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
            user: result.user,
        },
    });
});
const logout = (0, catchAsync_1.default)(async (req, res) => {
    res.clearCookie("accessToken", accessTokenCookieOptions);
    res.clearCookie("userInfo", legacyUserInfoCookieOptions);
    res.status(200).json({
        success: true,
        message: "Logout successful",
    });
});
const getCustomerProfile = (0, catchAsync_1.default)(async (req, res) => {
    const profile = await user_service_1.userService.getCustomerProfile(req.authUser.id);
    res.status(200).json({
        success: true,
        message: "Customer profile retrieved successfully",
        data: profile,
    });
});
const updateCustomerProfile = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, user_validation_1.parseRequestBody)(user_validation_1.updateCustomerProfileSchema, req.body);
    const profile = await user_service_1.userService.updateCustomerProfile(req.authUser.id, payload);
    res.status(200).json({
        success: true,
        message: "Customer profile updated successfully",
        data: profile,
    });
});
const deleteCustomerProfile = (0, catchAsync_1.default)(async (req, res) => {
    const payload = (0, user_validation_1.parseRequestBody)(user_validation_1.deleteCustomerProfileSchema, req.body);
    await user_service_1.userService.deleteCustomerProfile(req.authUser.id, payload);
    res.clearCookie("accessToken", accessTokenCookieOptions);
    res.clearCookie("userInfo", legacyUserInfoCookieOptions);
    res.status(200).json({
        success: true,
        message: "Customer profile deleted successfully",
    });
});
/* ========== FORGOT PASSWORD ========== */
const forgotPassword = (0, catchAsync_1.default)(async (req, res) => {
    const { email } = req.body;
    const result = await user_service_1.userService.forgotPassword(email);
    res.status(200).json({
        success: true,
        message: result.message,
    });
});
const getUsers = (0, catchAsync_1.default)(async (req, res) => {
    const users = await user_service_1.userService.getUsers();
    res.status(200).json({
        success: true,
        message: "successfully retrieved users",
        data: users,
    });
});
exports.userController = {
    createUser,
    login,
    logout,
    getCustomerProfile,
    updateCustomerProfile,
    deleteCustomerProfile,
    forgotPassword,
    getUsers,
};
