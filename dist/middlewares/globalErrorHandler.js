"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const multer_1 = __importDefault(require("multer"));
const apiAppError_1 = require("../utils/apiAppError");
const logger_1 = require("../utils/logger");
const globalErrorHandler = (error, req, res, _next) => {
    const errorRecord = typeof error === "object" && error !== null
        ? error
        : {};
    if (errorRecord.type === "entity.too.large") {
        logger_1.logger.warn({ path: req.originalUrl, method: req.method, ip: req.ip }, "Request body too large");
        return res.status(413).json({
            success: false,
            statusCode: 413,
            message: "Request payload is too large.",
        });
    }
    if (error instanceof multer_1.default.MulterError) {
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: error.code === "LIMIT_FILE_SIZE"
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
    if (error instanceof apiAppError_1.ApiAppError) {
        if (error.statusCode >= 500) {
            logger_1.logger.error({ error, path: req.originalUrl, method: req.method, ip: req.ip }, "Internal API error");
        }
        return res.status(error.statusCode).json({
            success: false,
            statusCode: error.statusCode,
            message: error.message,
            ...(error.code ? { code: error.code } : {}),
            ...(error.statusCode < 500 && error.details !== undefined
                ? { details: error.details }
                : {}),
        });
    }
    const prismaCode = typeof errorRecord.code === "string" ? errorRecord.code : undefined;
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
    logger_1.logger.error({
        error,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
    }, "Unhandled API error");
    res.status(500).json({
        success: false,
        statusCode: 500,
        message: "Internal server error",
    });
};
exports.globalErrorHandler = globalErrorHandler;
