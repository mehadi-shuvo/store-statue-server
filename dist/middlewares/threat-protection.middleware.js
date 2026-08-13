"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestAbortLogger = exports.requestSizeAndUrlGuard = exports.suspiciousRequestMiddleware = exports.temporaryIpBlockMiddleware = exports.registerAbusiveClient = void 0;
const security_config_1 = require("../config/security.config");
const logger_1 = require("../utils/logger");
const abuseMap = new Map();
const suspiciousPatterns = [
    /(\bunion\b.*\bselect\b)/i,
    /(\bor\b|\band\b)\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i,
    /;.*(--|\/\*)/i,
    /<script[\s>]/i,
    /\.\.\//,
    /%2e%2e%2f/i,
];
const getClientKey = (req) => req.ip || req.socket.remoteAddress || "unknown";
const isSuspiciousRequest = (req) => {
    const searchable = [
        req.originalUrl,
        JSON.stringify(req.query || {}),
        typeof req.body === "object" ? JSON.stringify(req.body) : String(req.body || ""),
    ].join(" ");
    return suspiciousPatterns.some((pattern) => pattern.test(searchable));
};
const registerAbusiveClient = (req, reason) => {
    const now = Date.now();
    const key = getClientKey(req);
    const state = abuseMap.get(key);
    if (!state || now - state.firstViolationAt > security_config_1.securityConfig.abuseBlock.violationWindowMs) {
        abuseMap.set(key, {
            violations: 1,
            firstViolationAt: now,
        });
        return;
    }
    state.violations += 1;
    if (state.violations >= security_config_1.securityConfig.abuseBlock.maxViolations) {
        state.blockedUntil = now + security_config_1.securityConfig.abuseBlock.blockMs;
        logger_1.logger.warn({
            ip: key,
            reason,
            blockedUntil: new Date(state.blockedUntil).toISOString(),
        }, "Temporarily blocked abusive client");
    }
};
exports.registerAbusiveClient = registerAbusiveClient;
const temporaryIpBlockMiddleware = (req, res, next) => {
    const key = getClientKey(req);
    const state = abuseMap.get(key);
    const now = Date.now();
    if (state?.blockedUntil && state.blockedUntil > now) {
        res.setHeader("Retry-After", Math.ceil((state.blockedUntil - now) / 1000));
        return res.status(429).json({
            success: false,
            statusCode: 429,
            message: "Too many suspicious requests. Please try again later.",
        });
    }
    if (state?.blockedUntil && state.blockedUntil <= now) {
        abuseMap.delete(key);
    }
    return next();
};
exports.temporaryIpBlockMiddleware = temporaryIpBlockMiddleware;
const suspiciousRequestMiddleware = (req, res, next) => {
    if (isSuspiciousRequest(req)) {
        (0, exports.registerAbusiveClient)(req, "suspicious_request");
        logger_1.logger.warn({
            ip: req.ip,
            path: req.originalUrl,
            method: req.method,
        }, "Suspicious request detected");
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: "Invalid request.",
        });
    }
    return next();
};
exports.suspiciousRequestMiddleware = suspiciousRequestMiddleware;
const requestSizeAndUrlGuard = (req, res, next) => {
    if (req.originalUrl.length > security_config_1.securityConfig.maxUrlLength) {
        logger_1.logger.warn({
            ip: req.ip,
            urlLength: req.originalUrl.length,
        }, "Request URL length exceeded");
        return res.status(414).json({
            success: false,
            statusCode: 414,
            message: "Request URL is too long.",
        });
    }
    return next();
};
exports.requestSizeAndUrlGuard = requestSizeAndUrlGuard;
const requestAbortLogger = (req, res, next) => {
    req.on("aborted", () => {
        logger_1.logger.warn({
            ip: req.ip,
            path: req.originalUrl,
            method: req.method,
        }, "Request aborted by client");
    });
    return next();
};
exports.requestAbortLogger = requestAbortLogger;
