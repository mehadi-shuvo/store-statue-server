"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./app/routes"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const globalErrorHandler_1 = require("./middlewares/globalErrorHandler");
const security_middleware_1 = require("./middlewares/security.middleware");
const rate_limit_middleware_1 = require("./middlewares/rate-limit.middleware");
const slow_down_middleware_1 = require("./middlewares/slow-down.middleware");
const threat_protection_middleware_1 = require("./middlewares/threat-protection.middleware");
const logger_1 = require("./utils/logger");
const security_config_1 = require("./config/security.config");
const app = (0, express_1.default)();
app.set("etag", false);
(0, security_middleware_1.applyHttpSecurity)(app);
app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
});
app.use(logger_1.httpLogger);
app.use(threat_protection_middleware_1.requestAbortLogger);
app.use(threat_protection_middleware_1.temporaryIpBlockMiddleware);
app.use(threat_protection_middleware_1.requestSizeAndUrlGuard);
app.use(rate_limit_middleware_1.publicApiRateLimiter);
app.use(rate_limit_middleware_1.burstRateLimiter);
app.use(slow_down_middleware_1.requestSlowDown);
app.use((req, res, next) => {
    req.setTimeout(security_config_1.securityConfig.requestTimeoutMs);
    res.setTimeout(security_config_1.securityConfig.requestTimeoutMs);
    next();
});
app.use(express_1.default.json({ limit: security_config_1.securityConfig.jsonBodyLimit }));
app.use(express_1.default.urlencoded({
    extended: true,
    limit: security_config_1.securityConfig.urlEncodedBodyLimit,
    parameterLimit: 100,
}));
app.use((0, cookie_parser_1.default)());
app.use(security_middleware_1.hppProtection);
app.use(threat_protection_middleware_1.suspiciousRequestMiddleware);
app.use("/api", routes_1.default);
app.use("/api/v1", routes_1.default);
app.get("/", (req, res) => {
    res.send(`game express server is running ...`);
});
app.use((req, res) => {
    res.status(404).json({
        success: false,
        statusCode: 404,
        message: `Route ${req.method} ${req.originalUrl} was not found.`,
    });
});
app.use(globalErrorHandler_1.globalErrorHandler);
exports.default = app;
