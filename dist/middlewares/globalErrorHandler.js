"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const apiAppError_1 = require("../utils/apiAppError");
const globalErrorHandler = (error, req, res, next) => {
    if (error instanceof apiAppError_1.ApiAppError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message,
            details: error.details,
        });
    }
    res.status(500).json({
        success: false,
        message: "Internal server error",
    });
};
exports.globalErrorHandler = globalErrorHandler;
