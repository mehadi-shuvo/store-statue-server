"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentProviderError = void 0;
class PaymentProviderError extends Error {
    constructor(message, provider, details) {
        super(message);
        this.provider = provider;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.PaymentProviderError = PaymentProviderError;
