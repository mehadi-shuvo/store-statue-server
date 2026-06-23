"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const user_service_1 = require("./user.service");
const createUser = (0, catchAsync_1.default)(async (req, res) => {
    const { email, name, phone, password } = req.body;
    const user = await user_service_1.userService.createUser({ email, name, phone, password });
    res.status(201).json({
        success: true,
        message: "successfully created user",
        data: user,
    });
});
const login = (0, catchAsync_1.default)(async (req, res) => {
    const { email, password } = req.body;
    const result = await user_service_1.userService.loginUser(email, password);
    res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 3 * 24 * 60 * 60 * 1000,
    });
    res.cookie("userInfo", JSON.stringify(result.user), {
        httpOnly: false,
        secure: false, // process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 3 * 24 * 60 * 60 * 1000,
    });
    res.status(200).json({
        success: true,
        message: "Login successful",
        data: result,
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
    forgotPassword,
    getUsers,
};
