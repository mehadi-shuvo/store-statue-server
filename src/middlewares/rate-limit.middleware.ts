import { NextFunction, Request, Response } from "express";
import { ApiAppError } from "../utils/apiAppError";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix: string;
};

type AttemptState = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptState>();
let requestCount = 0;

const sweepExpiredAttempts = (now: number) => {
  for (const [key, value] of attempts.entries()) {
    if (value.resetAt <= now) {
      attempts.delete(key);
    }
  }
};

const getClientKey = (req: Request, keyPrefix: string) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";

  return `${keyPrefix}:${clientIp}`;
};

export const createRateLimiter =
  ({ windowMs, max, message, keyPrefix }: RateLimitOptions) =>
  (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    requestCount += 1;

    if (requestCount % 100 === 0) {
      sweepExpiredAttempts(now);
    }

    const key = getClientKey(req, keyPrefix);
    const state = attempts.get(key);

    if (!state || state.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    state.count += 1;

    if (state.count > max) {
      const retryAfterSeconds = Math.ceil((state.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      return next(new ApiAppError(429, message));
    }

    return next();
  };
