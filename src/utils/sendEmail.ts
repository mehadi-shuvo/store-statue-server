// utils/sendEmail.ts
import nodemailer from "nodemailer";
import { ENV } from "./env-config";

export const sendEmail = async (to: string, subject: string, text: string) => {
  const transporter = nodemailer.createTransport({
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
