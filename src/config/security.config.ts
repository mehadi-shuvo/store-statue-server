import { ENV } from "../utils/env-config";

const fifteenMinutes = 15 * 60 * 1000;
const oneHour = 60 * 60 * 1000;

export const securityConfig = {
  trustProxyHops: ENV.TRUST_PROXY_HOPS,
  maxUrlLength: ENV.MAX_URL_LENGTH,
  requestTimeoutMs: ENV.REQUEST_TIMEOUT_MS,
  jsonBodyLimit: ENV.JSON_BODY_LIMIT,
  urlEncodedBodyLimit: ENV.URL_ENCODED_BODY_LIMIT,
  maxUploadSizeBytes: ENV.MAX_UPLOAD_SIZE_BYTES,
  redisUrl: ENV.REDIS_URL,
  rateLimits: {
    public: {
      windowMs: fifteenMinutes,
      limit: 100,
      keyPrefix: "rl:public",
      message: "Too many requests. Please try again later.",
    },
    login: {
      windowMs: fifteenMinutes,
      limit: 5,
      keyPrefix: "rl:auth:login",
      message: "Too many login attempts. Please try again later.",
    },
    register: {
      windowMs: oneHour,
      limit: 5,
      keyPrefix: "rl:auth:register",
      message: "Too many signup attempts. Please try again later.",
    },
    forgotPassword: {
      windowMs: oneHour,
      limit: 3,
      keyPrefix: "rl:auth:forgot-password",
      message: "Too many password reset attempts. Please try again later.",
    },
    otpVerify: {
      windowMs: oneHour,
      limit: 10,
      keyPrefix: "rl:auth:otp-verify",
      message: "Too many OTP verification attempts. Please try again later.",
    },
    resendOtp: {
      windowMs: 10 * 60 * 1000,
      limit: 3,
      keyPrefix: "rl:auth:resend-otp",
      message: "Too many OTP resend attempts. Please try again later.",
    },
    authenticatedUser: {
      windowMs: fifteenMinutes,
      limit: 300,
      keyPrefix: "rl:user",
      message: "Too many authenticated requests. Please try again later.",
    },
    payment: {
      windowMs: fifteenMinutes,
      limit: 20,
      keyPrefix: "rl:payment",
      message: "Too many payment requests. Please check the existing payment status before retrying.",
    },
    admin: {
      windowMs: 60 * 1000,
      limit: 100,
      keyPrefix: "rl:admin",
      message: "Too many admin requests. Please try again later.",
    },
    upload: {
      windowMs: oneHour,
      limit: 20,
      keyPrefix: "rl:upload",
      message: "Too many upload requests. Please try again later.",
    },
  },
  slowdown: {
    windowMs: fifteenMinutes,
    delayAfter: 60,
    delayMs: 250,
    maxDelayMs: 3000,
  },
  burstProtection: {
    windowMs: 10 * 1000,
    limit: 40,
    keyPrefix: "rl:burst",
    message: "Request burst detected. Please slow down.",
  },
  abuseBlock: {
    violationWindowMs: 10 * 60 * 1000,
    maxViolations: 5,
    blockMs: 30 * 60 * 1000,
  },
  cors: {
    allowedOrigins: [
      ENV.CLIENT_URL,
      ENV.FRONTEND_URL,
    ].filter(Boolean),
  },
};
