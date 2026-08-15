"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCardError = void 0;
const apiAppError_1 = require("../../utils/apiAppError");
const giftCardError = (statusCode, code, message, details) => new apiAppError_1.ApiAppError(statusCode, message, details, code);
exports.giftCardError = giftCardError;
