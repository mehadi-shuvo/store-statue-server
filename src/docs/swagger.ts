import type { Express, RequestHandler } from "express";
import swaggerUi from "swagger-ui-express";
import { ENV } from "../utils/env-config";
import { openApiDocument } from "./openapi";

const swaggerCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
].join("; ");

export const registerApiDocumentation = (app: Express) => {
  if (!ENV.API_DOCS_ENABLED) return;

  app.get("/api-docs.json", (_req, res) => res.json(openApiDocument));
  const setSwaggerSecurityHeaders: RequestHandler = (_req, res, next) => {
    res.setHeader("Content-Security-Policy", swaggerCsp);
    next();
  };

  app.use(
    "/api-docs",
    setSwaggerSecurityHeaders,
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "GameExpress API Documentation",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
    }),
  );
};
