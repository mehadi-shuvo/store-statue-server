"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
const apiAppError_1 = require("../../utils/apiAppError");
const env_config_1 = require("../../utils/env-config");
const prisma_client_1 = require("../../utils/prisma-client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const sendEmail_1 = require("../../utils/sendEmail");
const generateOTP_1 = require("../../utils/generateOTP");
const createUser = async (payload) => {
    // 1. Check if user already exists (Business Rule)
    const existingUser = await prisma_client_1.prismaC.user.findUnique({
        where: { email: payload.email },
    });
    if (existingUser) {
        throw new apiAppError_1.ApiAppError(409, "User with this email already exists");
    }
    // 2. Hash password
    let hashedPassword;
    try {
        hashedPassword = await bcryptjs_1.default.hash(payload.password, env_config_1.ENV.BCRYPT_SALT);
    }
    catch (error) {
        throw new apiAppError_1.ApiAppError(500, "Failed to hash password", error);
    }
    // 3. Create user
    try {
        const user = await prisma_client_1.prismaC.user.create({
            data: {
                email: payload.email,
                name: payload.name,
                phone: payload.phone,
                password: hashedPassword,
            },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                createdAt: true,
            },
        });
        return user;
    }
    catch (error) {
        throw new apiAppError_1.ApiAppError(500, "Failed to create user", error);
    }
};
const loginUser = async (email, password) => {
    const user = await prisma_client_1.prismaC.user.findUnique({ where: { email } });
    if (!user) {
        throw new apiAppError_1.ApiAppError(401, "Invalid email or password");
    }
    const isPasswordMatched = await bcryptjs_1.default.compare(password, user.password);
    if (!isPasswordMatched) {
        throw new apiAppError_1.ApiAppError(401, "Invalid email or password");
    }
    if (!env_config_1.ENV.JWT_SECRET) {
        throw new apiAppError_1.ApiAppError(500, "JWT secret is not configured. Set JWT_SECRET or JWT_ACCESS_SECRET in .env");
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, env_config_1.ENV.JWT_SECRET, { expiresIn: "3d", algorithm: "HS256" });
    return {
        accessToken: token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
        },
    };
};
const forgotPassword = async (email) => {
    const user = await prisma_client_1.prismaC.user.findUnique({
        where: { email },
    });
    if (!user) {
        throw new apiAppError_1.ApiAppError(404, "User not found");
    }
    const otp = (0, generateOTP_1.generateOtp)();
    const expireTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await prisma_client_1.prismaC.oTP.create({
        data: {
            code: otp,
            type: "AUTHENTICATION",
            expiresAt: expireTime,
            userId: user.id,
        },
    });
    await (0, sendEmail_1.sendEmail)(email, "Password Reset OTP", `Your password reset OTP is ${otp}. It will expire in 5 minutes.`);
    return { message: "OTP sent to your email" };
};
const verifyOtp = async (userId, otpCode, type) => {
    const otp = await prisma_client_1.prismaC.oTP.findFirst({
        where: {
            userId,
            code: otpCode,
            type,
            used: false,
            expiresAt: {
                gt: new Date(),
            },
        },
    });
    if (!otp) {
        throw new apiAppError_1.ApiAppError(400, "Invalid or expired OTP");
    }
    await prisma_client_1.prismaC.oTP.update({
        where: { id: otp.id },
        data: { used: true },
    });
    return true;
};
const getUsers = async () => {
    return prisma_client_1.prismaC.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            createdAt: true,
        },
    });
};
exports.userService = {
    createUser,
    loginUser,
    forgotPassword,
    verifyOtp,
    getUsers,
};
