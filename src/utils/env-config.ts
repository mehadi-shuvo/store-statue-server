import dotenv from "dotenv";
import { z } from "zod";
import { parseGameTopUpProviderEnvironment } from "../config/game-top-up-provider.config";
import { parsePaymentEnvironment } from "../config/payment.config";

dotenv.config();

const optionalUrl = z.union([z.literal(""), z.string().url()]).default("");
const bodyLimit = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d+)?(?:b|kb|mb|gb)$/i, "must include a byte unit such as kb or mb");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_DOCS_ENABLED: z.enum(["true", "false"]).optional(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5_000),
  DATABASE_URL: z
    .string()
    .trim()
    .min(1, "is required")
    .refine(
      (value) => /^postgres(?:ql)?:\/\//i.test(value),
      "must be a PostgreSQL connection URL",
    ),
  CLIENT_URL: optionalUrl,
  REDIS_URL: optionalUrl,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  JSON_BODY_LIMIT: bodyLimit.default("100kb"),
  URL_ENCODED_BODY_LIMIT: bodyLimit.default("100kb"),
  MAX_URL_LENGTH: z.coerce.number().int().min(256).max(16_384).default(2_048),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().int().positive().max(100 * 1024 * 1024).default(5 * 1024 * 1024),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).or(z.literal("")).default(""),
  LOG_TO_FILE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  LOG_DIR: z.string().trim().min(1).default("logs"),
  LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(14),
  JWT_SECRET: z.string().trim().default(""),
  JWT_EXPIRES_IN: z.string().trim().min(1).default("24h"),
  BCRYPT_SALT: z.coerce.number().int().min(10).max(15).default(12),
  TOP_UP_QUEUE_TIME_ZONE: z.string().trim().min(1).default("Asia/Dhaka"),
  TOP_UP_CANCELLATION_WINDOW_SECONDS: z.coerce.number().int().min(0).max(86_400).default(120),
  GIFT_CARD_RESERVATION_MINUTES: z.coerce.number().int().min(1).max(1_440).default(5),
  GIFT_CARD_RESERVATION_SWEEP_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(10_000),
  GIFT_CARD_EMAIL_RETRY_MINUTES: z.coerce.number().int().min(1).max(1_440).default(5),
  GIFT_CARD_EMAIL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  GIFT_CARD_ENCRYPTION_KEY: z.string().trim().default(""),
  CLOUDINARY_CLOUD_NAME: z.string().trim().default(""),
  CLOUDINARY_API_KEY: z.string().trim().default(""),
  CLOUDINARY_API_SECRET: z.string().trim().default(""),
  CLOUDINARY_PRODUCT_FOLDER: z.string().trim().min(1).default("ontor/products"),
  HOST_MAIL: z.string().trim().default(""),
  MAIL_SERVICE: z.string().trim().default(""),
  EMAIL_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  SENDER_MAIL_USER: z.string().trim().default(""),
  MAIL_PASS: z.string().default(""),
  MAIL_FROM: z.string().trim().default(""),
  EMAIL_VERIFICATION_OTP_TTL_MINUTES: z.coerce.number().int().min(1).max(1_440).default(10),
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(1).max(86_400).default(60),
});

const rawEnvironment = {
  ...process.env,
  JWT_SECRET: process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET,
  BCRYPT_SALT: process.env.SALT_ROUNDS,
  HOST_MAIL: process.env.SMTP_HOST || process.env.HOST,
  MAIL_SERVICE: process.env.SMTP_SERVICE || process.env.SERVICE,
  EMAIL_PORT: process.env.SMTP_PORT || process.env.EMAIL_PORT,
  SENDER_MAIL_USER: process.env.SMTP_USER || process.env.SENDER_MAIL_USER,
  MAIL_PASS: process.env.SMTP_PASSWORD || process.env.MAIL_PASS,
  MAIL_FROM: process.env.SMTP_FROM || process.env.MAIL_FROM,
};

const parsed = environmentSchema.safeParse(rawEnvironment);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

if (parsed.data.NODE_ENV === "production") {
  if (parsed.data.JWT_SECRET.length < 32) {
    throw new Error("Invalid environment configuration: production JWT secret must be at least 32 characters");
  }
  if (!parsed.data.CLIENT_URL && !process.env.FRONTEND_URL) {
    throw new Error("Invalid environment configuration: CLIENT_URL or FRONTEND_URL is required in production");
  }
  if (
    !parsed.data.SENDER_MAIL_USER ||
    !parsed.data.MAIL_PASS ||
    (!parsed.data.HOST_MAIL && !parsed.data.MAIL_SERVICE)
  ) {
    throw new Error(
      "Invalid environment configuration: production SMTP host/service, user, and password are required",
    );
  }
}

const { API_DOCS_ENABLED, ...applicationEnvironment } = parsed.data;

export const ENV = {
  ...applicationEnvironment,
  API_DOCS_ENABLED: API_DOCS_ENABLED
    ? API_DOCS_ENABLED === "true"
    : applicationEnvironment.NODE_ENV !== "production",
  ...parsePaymentEnvironment(rawEnvironment),
  ...parseGameTopUpProviderEnvironment(rawEnvironment),
};
