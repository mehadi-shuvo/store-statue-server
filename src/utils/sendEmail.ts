// utils/sendEmail.ts
import nodemailer from "nodemailer";
import { ApiAppError } from "./apiAppError";
import { ENV } from "./env-config";

export const sendEmail = async (to: string, subject: string, text: string) => {
  if (!ENV.SENDER_MAIL_USER || !ENV.MAIL_PASS) {
    throw new ApiAppError(500, "Email service is not configured");
  }

  const transporter = nodemailer.createTransport({
    ...(ENV.MAIL_SERVICE
      ? { service: ENV.MAIL_SERVICE }
      : { host: ENV.HOST_MAIL, port: ENV.EMAIL_PORT }),
    secure: ENV.EMAIL_PORT === 465,
    auth: {
      user: ENV.SENDER_MAIL_USER,
      pass: ENV.MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: ENV.SENDER_MAIL_USER,
    to,
    subject,
    text,
  });
};
