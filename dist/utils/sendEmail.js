"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
// utils/sendEmail.ts
const nodemailer_1 = __importDefault(require("nodemailer"));
const apiAppError_1 = require("./apiAppError");
const env_config_1 = require("./env-config");
const sendEmail = async (to, subject, text) => {
    if (!env_config_1.ENV.SENDER_MAIL_USER || !env_config_1.ENV.MAIL_PASS) {
        throw new apiAppError_1.ApiAppError(500, "Email service is not configured");
    }
    const transporter = nodemailer_1.default.createTransport({
        ...(env_config_1.ENV.MAIL_SERVICE
            ? { service: env_config_1.ENV.MAIL_SERVICE }
            : { host: env_config_1.ENV.HOST_MAIL, port: env_config_1.ENV.EMAIL_PORT }),
        secure: env_config_1.ENV.EMAIL_PORT === 465,
        auth: {
            user: env_config_1.ENV.SENDER_MAIL_USER,
            pass: env_config_1.ENV.MAIL_PASS,
        },
    });
    await transporter.sendMail({
        from: env_config_1.ENV.SENDER_MAIL_USER,
        to,
        subject,
        text,
    });
};
exports.sendEmail = sendEmail;
