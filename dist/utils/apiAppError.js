"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiAppError = void 0;
class ApiAppError extends Error {
    constructor(statusCode, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiAppError = ApiAppError;
