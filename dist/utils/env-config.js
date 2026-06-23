"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.ENV = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || "5000",
    DATABASE_URL: process.env.DATABASE_URL || "",
    JWT_SECRET: process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || "",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h",
    BCRYPT_SALT: parseInt(process.env.SALT_ROUNDS),
    // node mailer
    HOST_MAIL: process.env.HOST,
    MAIL_SERVICE: process.env.SERVICE,
    EMAIL_PORT: parseInt(process.env.EMAIL_PORT),
    SENDER_MAIL_USER: process.env.SENDER_MAIL_USER,
    MAIL_PASS: process.env.MAIL_PASS,
};
