import express, { Express, Request, Response } from "express";
import router from "./app/routes";

import cookieParser from "cookie-parser";
import { globalErrorHandler } from "./middlewares/globalErrorHandler";
import { applyHttpSecurity, hppProtection } from "./middlewares/security.middleware";
import {
  burstRateLimiter,
  publicApiRateLimiter,
} from "./middlewares/rate-limit.middleware";
import { requestSlowDown } from "./middlewares/slow-down.middleware";
import {
  requestAbortLogger,
  requestSizeAndUrlGuard,
  suspiciousRequestMiddleware,
  temporaryIpBlockMiddleware,
} from "./middlewares/threat-protection.middleware";
import { httpLogger } from "./utils/logger";
import { securityConfig } from "./config/security.config";
import { registerApiDocumentation } from "./docs/swagger";

const app: Express = express();

app.set("etag", false);

applyHttpSecurity(app);

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(httpLogger);
registerApiDocumentation(app);
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
app.use(requestAbortLogger);
app.use(temporaryIpBlockMiddleware);
app.use(requestSizeAndUrlGuard);
app.use(publicApiRateLimiter);
app.use(burstRateLimiter);
app.use(requestSlowDown);
app.use((req, res, next) => {
  req.setTimeout(securityConfig.requestTimeoutMs);
  res.setTimeout(securityConfig.requestTimeoutMs);
  next();
});
app.use(express.json({ limit: securityConfig.jsonBodyLimit }));
app.use(
  express.urlencoded({
    extended: true,
    limit: securityConfig.urlEncodedBodyLimit,
    parameterLimit: 100,
  }),
);
app.use(cookieParser());
app.use(hppProtection);
app.use(suspiciousRequestMiddleware);

app.use("/api", router);
app.use("/api/v1", router);

app.get("/", (req: Request, res: Response) => {
  res.send(`game express server is running ...`);
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Route ${req.method} ${req.originalUrl} was not found.`,
  });
});

app.use(globalErrorHandler);

export default app;
