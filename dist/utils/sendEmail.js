"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
// utils/sendEmail.ts
const nodemailer_1 = __importDefault(require("nodemailer"));
const sendEmail = async (to, subject, text) => {
    const transporter = nodemailer_1.default.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: "mehadihasanshuvo88@gmail.com",
            pass: "mubyqpxkroscmsso",
        },
    });
    await transporter.sendMail({
        from: "mehadihasanshuvo88@gmail.com",
        to,
        subject,
        text,
    });
};
exports.sendEmail = sendEmail;
