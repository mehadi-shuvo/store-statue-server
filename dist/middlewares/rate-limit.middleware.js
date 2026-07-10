"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = void 0;
const apiAppError_1 = require("../utils/apiAppError");
const attempts = new Map();
let requestCount = 0;
const sweepExpiredAttempts = (now) => {
    for (const [key, value] of attempts.entries()) {
        if (value.resetAt <= now) {
            attempts.delete(key);
        }
    }
};
const getClientKey = (req, keyPrefix) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    return `${keyPrefix}:${clientIp}`;
};
const createRateLimiter = ({ windowMs, max, message, keyPrefix }) => (req, res, next) => {
    const now = Date.now();
    requestCount += 1;
    if (requestCount % 100 === 0) {
        sweepExpiredAttempts(now);
    }
    const key = getClientKey(req, keyPrefix);
    const state = attempts.get(key);
    if (!state || state.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
        return next();
    }
    state.count += 1;
    if (state.count > max) {
        const retryAfterSeconds = Math.ceil((state.resetAt - now) / 1000);
        res.setHeader("Retry-After", retryAfterSeconds);
        return next(new apiAppError_1.ApiAppError(429, message));
    }
    return next();
};
exports.createRateLimiter = createRateLimiter;
