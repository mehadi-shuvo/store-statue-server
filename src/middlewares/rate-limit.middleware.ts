import { Request, RequestHandler, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import { securityConfig } from "../config/security.config";
import { ENV } from "../utils/env-config";
import { logger } from "../utils/logger";
import { registerAbusiveClient } from "./threat-protection.middleware";

type RateLimitOptions = {
  windowMs: number;
  limit?: number;
  max?: number;
  message: string;
  keyPrefix: string;
  keyByUser?: boolean;
};

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnectStarted = false;

const getRedisClient = () => {
  if (!securityConfig.redisUrl || ENV.NODE_ENV === "test") {
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({ url: securityConfig.redisUrl });
    redisClient.on("error", (error) => {
      logger.error({ error }, "Redis rate-limit client error");
    });
  }

  if (!redisConnectStarted) {
    redisConnectStarted = true;
    redisClient.connect().catch((error) => {
      logger.error({ error }, "Failed to connect Redis rate-limit client");
    });
  }

  return redisClient;
};

const createRedisStore = (prefix: string) => {
  const client = getRedisClient();

  if (!client) {
    return undefined;
  }

  return new RedisStore({
    prefix: `${prefix}:`,
    sendCommand: (...args: string[]) => client.sendCommand(args),
  });
};

const sendRateLimitResponse = (
  req: Request,
  res: Response,
  message: string,
) => {
  registerAbusiveClient(req, "rate_limit");
  logger.warn(
    {
      ip: req.ip,
      path: req.originalUrl,
      method: req.method,
      authUserId: req.authUser?.id,
    },
    "Rate limit exceeded",
  );

  return res.status(429).json({
    success: false,
    statusCode: 429,
    message,
  });
};

const getIpKey = (req: Request) => ipKeyGenerator(req.ip || "unknown");

const getUserAwareKey = (req: Request) => {
  if (req.authUser?.id) {
    return `user:${req.authUser.id}`;
  }

  return `ip:${getIpKey(req)}`;
};

export const createRateLimiter = ({
  windowMs,
  limit,
  max,
  message,
  keyPrefix,
  keyByUser = false,
}: RateLimitOptions): RequestHandler =>
  rateLimit({
    windowMs,
    limit: limit ?? max ?? 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: true,
    store: createRedisStore(keyPrefix),
    keyGenerator: keyByUser ? getUserAwareKey : getIpKey,
    handler: (req, res) => sendRateLimitResponse(req, res, message),
  });

export const publicApiRateLimiter = createRateLimiter(securityConfig.rateLimits.public);
export const loginRateLimiter = createRateLimiter(securityConfig.rateLimits.login);
export const registerRateLimiter = createRateLimiter(securityConfig.rateLimits.register);
export const forgotPasswordRateLimiter = createRateLimiter(
  securityConfig.rateLimits.forgotPassword,
);
export const otpVerifyRateLimiter = createRateLimiter(securityConfig.rateLimits.otpVerify);
export const resendOtpRateLimiter = createRateLimiter(securityConfig.rateLimits.resendOtp);
export const authenticatedUserRateLimiter = createRateLimiter({
  ...securityConfig.rateLimits.authenticatedUser,
  keyByUser: true,
});
export const paymentRateLimiter = createRateLimiter({
  ...securityConfig.rateLimits.payment,
  keyByUser: true,
});
export const adminRateLimiter = createRateLimiter({
  ...securityConfig.rateLimits.admin,
  keyByUser: true,
});
export const uploadRateLimiter = createRateLimiter({
  ...securityConfig.rateLimits.upload,
  keyByUser: true,
});
export const burstRateLimiter = createRateLimiter(securityConfig.burstProtection);
