"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyHttpSecurity = exports.hppProtection = void 0;
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const hpp_1 = __importDefault(require("hpp"));
const security_config_1 = require("../config/security.config");
const apiAppError_1 = require("../utils/apiAppError");
const env_config_1 = require("../utils/env-config");
const normalizeOrigin = (origin) => origin.replace(/\/+$/, "");
const allowedOrigins = security_config_1.securityConfig.cors.allowedOrigins.map(normalizeOrigin);
const isLocalDevOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizeOrigin(origin));
exports.hppProtection = (0, hpp_1.default)();
const applyHttpSecurity = (app) => {
    app.disable("x-powered-by");
    app.set("trust proxy", security_config_1.securityConfig.trustProxyHops);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                "default-src": ["'self'"],
                "base-uri": ["'self'"],
                "frame-ancestors": ["'none'"],
                "object-src": ["'none'"],
                "script-src": ["'self'"],
                "style-src": ["'self'", "'unsafe-inline'"],
                "img-src": ["'self'", "data:", "https:"],
                "connect-src": ["'self'", ...allowedOrigins],
            },
        },
        crossOriginResourcePolicy: { policy: "cross-origin" },
        referrerPolicy: { policy: "no-referrer" },
    }));
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            if (!origin) {
                return callback(null, true);
            }
            const normalizedOrigin = normalizeOrigin(origin);
            if (allowedOrigins.includes(normalizedOrigin) ||
                (env_config_1.ENV.NODE_ENV !== "production" && isLocalDevOrigin(normalizedOrigin))) {
                return callback(null, true);
            }
            return callback(new apiAppError_1.ApiAppError(403, "Origin is not allowed by CORS"));
        },
        credentials: true,
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        maxAge: 600,
    }));
    app.use((0, compression_1.default)());
};
exports.applyHttpSecurity = applyHttpSecurity;
