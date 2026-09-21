// utils/sendEmail.ts
import nodemailer from "nodemailer";
import { ApiAppError } from "./apiAppError";
import { ENV } from "./env-config";
import { logger } from "./logger";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailSender = {
  send(message: EmailMessage): Promise<unknown>;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

const getTransporter = () => {
  if (!ENV.SENDER_MAIL_USER || !ENV.MAIL_PASS || (!ENV.MAIL_SERVICE && !ENV.HOST_MAIL)) {
    throw new ApiAppError(500, "Email service is not configured");
  }

  transporter ??= nodemailer.createTransport({
    ...(ENV.HOST_MAIL
      ? { host: ENV.HOST_MAIL, port: ENV.EMAIL_PORT }
      : { service: ENV.MAIL_SERVICE }),
    secure: ENV.EMAIL_PORT === 465,
    requireTLS: ENV.EMAIL_PORT !== 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    tls: { minVersion: "TLSv1.2" },
    auth: {
      user: ENV.SENDER_MAIL_USER,
      pass: ENV.MAIL_PASS,
    },
  });
  return transporter;
};

const recipientDomain = (to: string) => to.split("@").pop() || "unknown";

export const sendEmail = async ({ to, subject, text, html }: EmailMessage) => {
  try {
    const info = await getTransporter().sendMail({
      from: ENV.MAIL_FROM || ENV.SENDER_MAIL_USER,
      to,
      subject,
      text,
      html,
    });

    logger.info(
      { messageId: info.messageId, recipientDomain: recipientDomain(to) },
      "Email accepted by SMTP server",
    );
    return info;
  } catch (error) {
    const details = error as { name?: string; code?: string; command?: string };
    logger.error(
      {
        recipientDomain: recipientDomain(to),
        errorType: details.name || "EmailProviderError",
        smtpCode: details.code,
        smtpCommand: details.command,
      },
      "Email delivery failed",
    );
    if (error instanceof ApiAppError) throw error;
    throw new ApiAppError(502, "Email delivery failed");
  }
};
