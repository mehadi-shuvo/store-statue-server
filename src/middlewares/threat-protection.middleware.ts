import { NextFunction, Request, Response } from "express";
import { securityConfig } from "../config/security.config";
import { logger } from "../utils/logger";

type AbuseState = {
  violations: number;
  firstViolationAt: number;
  blockedUntil?: number;
};

const abuseMap = new Map<string, AbuseState>();

const suspiciousPatterns = [
  /(\bunion\b.*\bselect\b)/i,
  /(\bor\b|\band\b)\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i,
  /;.*(--|\/\*)/i,
  /<script[\s>]/i,
  /\.\.\//,
  /%2e%2e%2f/i,
];

const getClientKey = (req: Request) => req.ip || req.socket.remoteAddress || "unknown";

const isSuspiciousRequest = (req: Request) => {
  const searchable = [
    req.originalUrl,
    JSON.stringify(req.query || {}),
    typeof req.body === "object" ? JSON.stringify(req.body) : String(req.body || ""),
  ].join(" ");

  return suspiciousPatterns.some((pattern) => pattern.test(searchable));
};

export const registerAbusiveClient = (req: Request, reason: string) => {
  const now = Date.now();
  const key = getClientKey(req);
  const state = abuseMap.get(key);

  if (!state || now - state.firstViolationAt > securityConfig.abuseBlock.violationWindowMs) {
    abuseMap.set(key, {
      violations: 1,
      firstViolationAt: now,
    });
    return;
  }

  state.violations += 1;

  if (state.violations >= securityConfig.abuseBlock.maxViolations) {
    state.blockedUntil = now + securityConfig.abuseBlock.blockMs;
    logger.warn(
      {
        ip: key,
        reason,
        blockedUntil: new Date(state.blockedUntil).toISOString(),
      },
      "Temporarily blocked abusive client",
    );
  }
};

export const temporaryIpBlockMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const key = getClientKey(req);
  const state = abuseMap.get(key);
  const now = Date.now();

  if (state?.blockedUntil && state.blockedUntil > now) {
    res.setHeader("Retry-After", Math.ceil((state.blockedUntil - now) / 1000));
    return res.status(429).json({
      success: false,
      statusCode: 429,
      message: "Too many suspicious requests. Please try again later.",
    });
  }

  if (state?.blockedUntil && state.blockedUntil <= now) {
    abuseMap.delete(key);
  }

  return next();
};

export const suspiciousRequestMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (isSuspiciousRequest(req)) {
    registerAbusiveClient(req, "suspicious_request");
    logger.warn(
      {
        ip: req.ip,
        path: req.originalUrl,
        method: req.method,
      },
      "Suspicious request detected",
    );

    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Invalid request.",
    });
  }

  return next();
};

export const requestSizeAndUrlGuard = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.originalUrl.length > securityConfig.maxUrlLength) {
    logger.warn(
      {
        ip: req.ip,
        urlLength: req.originalUrl.length,
      },
      "Request URL length exceeded",
    );

    return res.status(414).json({
      success: false,
      statusCode: 414,
      message: "Request URL is too long.",
    });
  }

  return next();
};

export const requestAbortLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  req.on("aborted", () => {
    logger.warn(
      {
        ip: req.ip,
        path: req.originalUrl,
        method: req.method,
      },
      "Request aborted by client",
    );
  });

  return next();
};
