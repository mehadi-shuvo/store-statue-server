"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.authorizeRoles = exports.optionalAuthenticateUser = exports.authenticateUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("../generated/prisma/client");
const apiAppError_1 = require("../utils/apiAppError");
const env_config_1 = require("../utils/env-config");
const prisma_client_1 = require("../utils/prisma-client");
const getTokenFromRequest = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice("Bearer ".length);
    }
    return req.cookies?.accessToken;
};
const authenticateUser = async (req, res, next) => {
    try {
        const token = getTokenFromRequest(req);
        if (!token) {
            throw new apiAppError_1.ApiAppError(401, "Authentication token is required");
        }
        if (!env_config_1.ENV.JWT_SECRET) {
            throw new apiAppError_1.ApiAppError(500, "JWT secret is not configured");
        }
        const decoded = jsonwebtoken_1.default.verify(token, env_config_1.ENV.JWT_SECRET);
        if (!decoded.userId) {
            throw new apiAppError_1.ApiAppError(401, "Invalid authentication token");
        }
        const user = await prisma_client_1.prismaC.user.findFirst({
            where: {
                id: decoded.userId,
                isDeleted: false,
            },
            select: {
                id: true,
                email: true,
                role: true,
            },
        });
        if (!user) {
            throw new apiAppError_1.ApiAppError(401, "User not found or inactive");
        }
        req.authUser = user;
        next();
    }
    catch (error) {
        if (error instanceof apiAppError_1.ApiAppError) {
            return next(error);
        }
        return next(new apiAppError_1.ApiAppError(401, "Invalid or expired authentication token"));
    }
};
exports.authenticateUser = authenticateUser;
const optionalAuthenticateUser = async (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (!token) {
        return next();
    }
    return (0, exports.authenticateUser)(req, res, next);
};
exports.optionalAuthenticateUser = optionalAuthenticateUser;
const authorizeRoles = (...roles) => (req, res, next) => {
    if (!req.authUser) {
        return next(new apiAppError_1.ApiAppError(401, "Authentication token is required"));
    }
    if (!roles.includes(req.authUser.role)) {
        return next(new apiAppError_1.ApiAppError(403, "You are not allowed to perform this action"));
    }
    return next();
};
exports.authorizeRoles = authorizeRoles;
exports.requireAdmin = (0, exports.authorizeRoles)(client_1.UserRole.ADMIN, client_1.UserRole.SUPER_ADMIN);
