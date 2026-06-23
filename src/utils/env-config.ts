import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || "5000",
  DATABASE_URL: process.env.DATABASE_URL || "",
  CLIENT_URL: process.env.CLIENT_URL || "",
  JWT_SECRET:
    process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h",
  BCRYPT_SALT: parseInt(process.env.SALT_ROUNDS as string),

  // node mailer
  HOST_MAIL: process.env.HOST,
  MAIL_SERVICE: process.env.SERVICE,
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT as string),
  SENDER_MAIL_USER: process.env.SENDER_MAIL_USER,
  MAIL_PASS: process.env.MAIL_PASS,
};
