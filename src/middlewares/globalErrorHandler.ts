// app/middlewares/globalErrorHandler.ts
import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { ApiAppError } from "../utils/apiAppError";
import { logger } from "../utils/logger";

export const globalErrorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const errorRecord =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};

  if (errorRecord.type === "entity.too.large") {
    logger.warn(
      { path: req.originalUrl, method: req.method, ip: req.ip },
      "Request body too large",
    );

    return res.status(413).json({
      success: false,
      statusCode: 413,
      message: "Request payload is too large.",
    });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Image file size must be 5MB or less."
          : error.message,
    });
  }

  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Invalid JSON payload.",
    });
  }

  if (error instanceof ApiAppError) {
    if (error.statusCode >= 500) {
      logger.error(
        { error, path: req.originalUrl, method: req.method, ip: req.ip },
        "Internal API error",
      );
    }

    return res.status(error.statusCode).json({
      success: false,
      statusCode: error.statusCode,
      message: error.message,
      ...(error.statusCode < 500 && error.details !== undefined
        ? { details: error.details }
        : {}),
    });
  }

  const prismaCode =
    typeof errorRecord.code === "string" ? errorRecord.code : undefined;
  if (prismaCode === "P2002") {
    return res.status(409).json({
      success: false,
      statusCode: 409,
      message: "A record with the same unique value already exists.",
    });
  }
  if (prismaCode === "P2003") {
    return res.status(409).json({
      success: false,
      statusCode: 409,
      message: "This operation conflicts with a related record.",
    });
  }
  if (prismaCode === "P2025") {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: "The requested record was not found.",
    });
  }
  if (error instanceof Error && error.name === "PrismaClientValidationError") {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Invalid database operation input.",
    });
  }

  logger.error(
    {
      error,
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
    },
    "Unhandled API error",
  );

  res.status(500).json({
    success: false,
    statusCode: 500,
    message: "Internal server error",
  });
};
