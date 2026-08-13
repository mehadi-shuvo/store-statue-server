"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const readNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
exports.ENV = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || "5000",
    DATABASE_URL: process.env.DATABASE_URL || "",
    CLIENT_URL: process.env.CLIENT_URL || "",
    REDIS_URL: process.env.REDIS_URL || "",
    TRUST_PROXY_HOPS: readNumber(process.env.TRUST_PROXY_HOPS, 1),
    JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || "100kb",
    URL_ENCODED_BODY_LIMIT: process.env.URL_ENCODED_BODY_LIMIT || "100kb",
    MAX_URL_LENGTH: readNumber(process.env.MAX_URL_LENGTH, 2048),
    REQUEST_TIMEOUT_MS: readNumber(process.env.REQUEST_TIMEOUT_MS, 30000),
    MAX_UPLOAD_SIZE_BYTES: readNumber(process.env.MAX_UPLOAD_SIZE_BYTES, 5 * 1024 * 1024),
    LOG_LEVEL: process.env.LOG_LEVEL || "",
    LOG_DIR: process.env.LOG_DIR || "logs",
    LOG_RETENTION_DAYS: readNumber(process.env.LOG_RETENTION_DAYS, 14),
    JWT_SECRET: process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || "",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h",
    BCRYPT_SALT: readNumber(process.env.SALT_ROUNDS, 12),
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || "mock",
    BKASH_BASE_URL: process.env.BKASH_BASE_URL || "",
    BKASH_APP_KEY: process.env.BKASH_APP_KEY || "",
    BKASH_APP_SECRET: process.env.BKASH_APP_SECRET || "",
    BKASH_USERNAME: process.env.BKASH_USERNAME || "",
    BKASH_PASSWORD: process.env.BKASH_PASSWORD || "",
    BKASH_CALLBACK_URL: process.env.BKASH_CALLBACK_URL || "",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
    CLOUDINARY_PRODUCT_FOLDER: process.env.CLOUDINARY_PRODUCT_FOLDER || "ontor/products",
    // node mailer
    HOST_MAIL: process.env.SMTP_HOST || process.env.HOST,
    MAIL_SERVICE: process.env.SMTP_SERVICE || process.env.SERVICE,
    EMAIL_PORT: readNumber(process.env.SMTP_PORT || process.env.EMAIL_PORT, 587),
    SENDER_MAIL_USER: process.env.SMTP_USER || process.env.SENDER_MAIL_USER,
    MAIL_PASS: process.env.SMTP_PASSWORD || process.env.MAIL_PASS,
};
