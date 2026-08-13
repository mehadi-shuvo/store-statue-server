"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.burstRateLimiter = exports.uploadRateLimiter = exports.adminRateLimiter = exports.authenticatedUserRateLimiter = exports.resendOtpRateLimiter = exports.otpVerifyRateLimiter = exports.forgotPasswordRateLimiter = exports.registerRateLimiter = exports.loginRateLimiter = exports.publicApiRateLimiter = exports.createRateLimiter = void 0;
const express_rate_limit_1 = require("express-rate-limit");
const rate_limit_redis_1 = require("rate-limit-redis");
const redis_1 = require("redis");
const security_config_1 = require("../config/security.config");
const logger_1 = require("../utils/logger");
const threat_protection_middleware_1 = require("./threat-protection.middleware");
let redisClient = null;
let redisConnectStarted = false;
const getRedisClient = () => {
    if (!security_config_1.securityConfig.redisUrl) {
        return null;
    }
    if (!redisClient) {
        redisClient = (0, redis_1.createClient)({ url: security_config_1.securityConfig.redisUrl });
        redisClient.on("error", (error) => {
            logger_1.logger.error({ error }, "Redis rate-limit client error");
        });
    }
    if (!redisConnectStarted) {
        redisConnectStarted = true;
        redisClient.connect().catch((error) => {
            logger_1.logger.error({ error }, "Failed to connect Redis rate-limit client");
        });
    }
    return redisClient;
};
const createRedisStore = (prefix) => {
    const client = getRedisClient();
    if (!client) {
        return undefined;
    }
    return new rate_limit_redis_1.RedisStore({
        prefix: `${prefix}:`,
        sendCommand: (...args) => client.sendCommand(args),
    });
};
const sendRateLimitResponse = (req, res, message) => {
    (0, threat_protection_middleware_1.registerAbusiveClient)(req, "rate_limit");
    logger_1.logger.warn({
        ip: req.ip,
        path: req.originalUrl,
        method: req.method,
        authUserId: req.authUser?.id,
    }, "Rate limit exceeded");
    return res.status(429).json({
        success: false,
        statusCode: 429,
        message,
    });
};
const getIpKey = (req) => (0, express_rate_limit_1.ipKeyGenerator)(req.ip || "unknown");
const getUserAwareKey = (req) => {
    if (req.authUser?.id) {
        return `user:${req.authUser.id}`;
    }
    return `ip:${getIpKey(req)}`;
};
const createRateLimiter = ({ windowMs, limit, max, message, keyPrefix, keyByUser = false, }) => (0, express_rate_limit_1.rateLimit)({
    windowMs,
    limit: limit ?? max ?? 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: true,
    store: createRedisStore(keyPrefix),
    keyGenerator: keyByUser ? getUserAwareKey : getIpKey,
    handler: (req, res) => sendRateLimitResponse(req, res, message),
});
exports.createRateLimiter = createRateLimiter;
exports.publicApiRateLimiter = (0, exports.createRateLimiter)(security_config_1.securityConfig.rateLimits.public);
exports.loginRateLimiter = (0, exports.createRateLimiter)(security_config_1.securityConfig.rateLimits.login);
exports.registerRateLimiter = (0, exports.createRateLimiter)(security_config_1.securityConfig.rateLimits.register);
exports.forgotPasswordRateLimiter = (0, exports.createRateLimiter)(security_config_1.securityConfig.rateLimits.forgotPassword);
exports.otpVerifyRateLimiter = (0, exports.createRateLimiter)(security_config_1.securityConfig.rateLimits.otpVerify);
exports.resendOtpRateLimiter = (0, exports.createRateLimiter)(security_config_1.securityConfig.rateLimits.resendOtp);
exports.authenticatedUserRateLimiter = (0, exports.createRateLimiter)({
    ...security_config_1.securityConfig.rateLimits.authenticatedUser,
    keyByUser: true,
});
exports.adminRateLimiter = (0, exports.createRateLimiter)({
    ...security_config_1.securityConfig.rateLimits.admin,
    keyByUser: true,
});
exports.uploadRateLimiter = (0, exports.createRateLimiter)({
    ...security_config_1.securityConfig.rateLimits.upload,
    keyByUser: true,
});
exports.burstRateLimiter = (0, exports.createRateLimiter)(security_config_1.securityConfig.burstProtection);
