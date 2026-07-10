import dotenv from "dotenv";
dotenv.config();

const readNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || "5000",
  DATABASE_URL: process.env.DATABASE_URL || "",
  CLIENT_URL: process.env.CLIENT_URL || "",
  JWT_SECRET:
    process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h",
  BCRYPT_SALT: readNumber(process.env.SALT_ROUNDS, 12),

  // node mailer
  HOST_MAIL: process.env.HOST,
  MAIL_SERVICE: process.env.SERVICE,
  EMAIL_PORT: readNumber(process.env.EMAIL_PORT, 587),
  SENDER_MAIL_USER: process.env.SENDER_MAIL_USER,
  MAIL_PASS: process.env.MAIL_PASS,
};
