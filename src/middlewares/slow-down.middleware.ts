import { slowDown } from "express-slow-down";
import { ipKeyGenerator } from "express-rate-limit";
import { securityConfig } from "../config/security.config";

export const requestSlowDown = slowDown({
  windowMs: securityConfig.slowdown.windowMs,
  delayAfter: securityConfig.slowdown.delayAfter,
  delayMs: () => securityConfig.slowdown.delayMs,
  maxDelayMs: securityConfig.slowdown.maxDelayMs,
  keyGenerator: (req) => ipKeyGenerator(req.ip || "unknown"),
});
