"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BkashProvider = void 0;
const env_config_1 = require("../../../utils/env-config");
const payment_utils_1 = require("../utils/payment.utils");
const payment_provider_error_1 = require("../utils/payment-provider-error");
class BkashProvider {
    constructor() {
        this.name = "bkash";
        this.token = null;
    }
    get baseUrl() {
        return env_config_1.ENV.BKASH_BASE_URL.replace(/\/+$/, "");
    }
    ensureConfig() {
        const missing = [
            ["BKASH_BASE_URL", env_config_1.ENV.BKASH_BASE_URL],
            ["BKASH_APP_KEY", env_config_1.ENV.BKASH_APP_KEY],
            ["BKASH_APP_SECRET", env_config_1.ENV.BKASH_APP_SECRET],
            ["BKASH_USERNAME", env_config_1.ENV.BKASH_USERNAME],
            ["BKASH_PASSWORD", env_config_1.ENV.BKASH_PASSWORD],
            ["BKASH_CALLBACK_URL", env_config_1.ENV.BKASH_CALLBACK_URL],
        ].filter(([, value]) => !value);
        if (missing.length > 0) {
            throw new payment_provider_error_1.PaymentProviderError("bKash provider is not configured", this.name, {
                missing: missing.map(([key]) => key),
            });
        }
    }
    async request(path, body, token) {
        this.ensureConfig();
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                username: env_config_1.ENV.BKASH_USERNAME,
                password: env_config_1.ENV.BKASH_PASSWORD,
                ...(token ? { authorization: token, "x-app-key": env_config_1.ENV.BKASH_APP_KEY } : {}),
            },
            body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !(0, payment_utils_1.isRecord)(payload)) {
            throw new payment_provider_error_1.PaymentProviderError("bKash request failed", this.name, {
                status: response.status,
                path,
            });
        }
        return payload;
    }
    async getToken() {
        if (this.token) {
            return this.token;
        }
        const payload = await this.request("/tokenized/checkout/token/grant", {
            app_key: env_config_1.ENV.BKASH_APP_KEY,
            app_secret: env_config_1.ENV.BKASH_APP_SECRET,
        });
        const token = payload.id_token || payload.token;
        if (!token) {
            throw new payment_provider_error_1.PaymentProviderError("bKash token response is invalid", this.name);
        }
        this.token = token;
        return token;
    }
    async createPayment(input) {
        const token = await this.getToken();
        const payload = await this.request("/tokenized/checkout/create", {
            mode: "0011",
            payerReference: input.orderId,
            callbackURL: env_config_1.ENV.BKASH_CALLBACK_URL,
            amount: input.amount.toFixed(2),
            currency: input.currency,
            intent: "sale",
            merchantInvoiceNumber: input.invoiceNumber,
        }, token);
        const paymentID = String(payload.paymentID || "");
        const bkashURL = String(payload.bkashURL || "");
        if (!paymentID || !bkashURL) {
            throw new payment_provider_error_1.PaymentProviderError("bKash create payment response is invalid", this.name);
        }
        return {
            paymentID,
            bkashURL,
            statusCode: String(payload.statusCode || ""),
            statusMessage: String(payload.statusMessage || ""),
            raw: payload,
        };
    }
    async executePayment(input) {
        const token = await this.getToken();
        const payload = await this.request("/tokenized/checkout/execute", { paymentID: input.paymentId }, token);
        return {
            trxID: typeof payload.trxID === "string" ? payload.trxID : null,
            paymentID: String(payload.paymentID || input.paymentId),
            amount: Number(payload.amount || input.amount),
            transactionStatus: payload.transactionStatus === "Completed" ? "Completed" : "Failed",
            raw: payload,
        };
    }
    async queryPayment(input) {
        const token = await this.getToken();
        const payload = await this.request("/tokenized/checkout/payment/status", { paymentID: input.paymentId }, token);
        return {
            paymentID: String(payload.paymentID || input.paymentId),
            transactionStatus: payload.transactionStatus === "Completed" ? "Completed" : "Pending",
            trxID: typeof payload.trxID === "string" ? payload.trxID : null,
            amount: Number(payload.amount || 0),
            raw: payload,
        };
    }
    async verifyPayment(input) {
        return this.queryPayment({ paymentId: input.paymentId });
    }
}
exports.BkashProvider = BkashProvider;
