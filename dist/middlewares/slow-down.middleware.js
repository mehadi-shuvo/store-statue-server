"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestSlowDown = void 0;
const express_slow_down_1 = require("express-slow-down");
const express_rate_limit_1 = require("express-rate-limit");
const security_config_1 = require("../config/security.config");
exports.requestSlowDown = (0, express_slow_down_1.slowDown)({
    windowMs: security_config_1.securityConfig.slowdown.windowMs,
    delayAfter: security_config_1.securityConfig.slowdown.delayAfter,
    delayMs: () => security_config_1.securityConfig.slowdown.delayMs,
    maxDelayMs: security_config_1.securityConfig.slowdown.maxDelayMs,
    keyGenerator: (req) => (0, express_rate_limit_1.ipKeyGenerator)(req.ip || "unknown"),
});
