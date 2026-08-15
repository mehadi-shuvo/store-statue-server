"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGiftCardOrderNumber = exports.normalizeDeliveryEmail = exports.maskGiftCardCode = exports.moneyString = void 0;
const node_crypto_1 = require("node:crypto");
const moneyString = (value) => typeof value === "object"
    ? value.toFixed(2)
    : (() => {
        const [whole, fraction = ""] = String(value).split(".");
        return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
    })();
exports.moneyString = moneyString;
const maskGiftCardCode = (code) => {
    const parts = code.split("-");
    if (parts.length >= 3) {
        return [parts[0], ...parts.slice(1, -1).map((part) => "*".repeat(Math.max(part.length, 4))), parts[parts.length - 1]].join("-");
    }
    if (code.length <= 4)
        return "*".repeat(code.length);
    return `${code.slice(0, 4)}${"*".repeat(Math.max(code.length - 8, 4))}${code.slice(-4)}`;
};
exports.maskGiftCardCode = maskGiftCardCode;
const normalizeDeliveryEmail = (email) => email.trim().toLowerCase();
exports.normalizeDeliveryEmail = normalizeDeliveryEmail;
const createGiftCardOrderNumber = (now = new Date()) => {
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    return `GC-${date}-${(0, node_crypto_1.randomUUID)().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
};
exports.createGiftCardOrderNumber = createGiftCardOrderNumber;
