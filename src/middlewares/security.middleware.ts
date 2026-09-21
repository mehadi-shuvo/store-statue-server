import compression from "compression";
import cors from "cors";
import { Express } from "express";
import helmet from "helmet";
import hpp from "hpp";
import { securityConfig } from "../config/security.config";
import { ApiAppError } from "../utils/apiAppError";
import { ENV } from "../utils/env-config";

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, "");

const allowedOrigins = securityConfig.cors.allowedOrigins.map(normalizeOrigin);
const isLocalDevOrigin = (origin: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizeOrigin(origin));

export const hppProtection = hpp();

export const applyHttpSecurity = (app: Express) => {
  app.disable("x-powered-by");
  app.set("trust proxy", securityConfig.trustProxyHops);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "base-uri": ["'self'"],
          "frame-ancestors": ["'none'"],
          "object-src": ["'none'"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:", "https:"],
          "connect-src": ["'self'", ...allowedOrigins],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  const frontendCors = cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);

      if (
        allowedOrigins.includes(normalizedOrigin) ||
        (ENV.NODE_ENV !== "production" && isLocalDevOrigin(normalizedOrigin))
      ) {
        return callback(null, true);
      }

      return callback(new ApiAppError(403, "Origin is not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Idempotency-Key"],
    maxAge: 600,
  });
  app.use((req, res, next) => {
    // Cross-site gateway form navigation is not a frontend CORS request.
    if (["POST", "GET"].includes(req.method) && /^\/api(?:\/v1)?\/payments\/aamarpay\/(success|fail|cancel)\/?$/.test(req.path)) return next();
    return frontendCors(req, res, next);
  });

  app.use(compression());
};
