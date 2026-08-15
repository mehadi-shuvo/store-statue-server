"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const gift_card_validation_1 = require("../gift-card.validation");
const gift_card_utils_1 = require("../gift-card.utils");
const validate_middleware_1 = require("../../../middlewares/validate.middleware");
const gift_card_validation_2 = require("../gift-card.validation");
const auth_middleware_1 = require("../../../middlewares/auth.middleware");
const client_1 = require("../../../generated/prisma/client");
const apiAppError_1 = require("../../../utils/apiAppError");
(0, node_test_1.default)("inventory codes are masked without exposing middle segments", () => {
    strict_1.default.equal((0, gift_card_utils_1.maskGiftCardCode)("AMZN-1111-AAAA"), "AMZN-****-AAAA");
    strict_1.default.equal((0, gift_card_utils_1.maskGiftCardCode)("ABCD1234EFGH"), "ABCD****EFGH");
});
(0, node_test_1.default)("money is serialized to two decimal places", () => {
    strict_1.default.equal((0, gift_card_utils_1.moneyString)("1280"), "1280.00");
    strict_1.default.equal((0, gift_card_utils_1.moneyString)("10.5"), "10.50");
});
(0, node_test_1.default)("order numbers use the gift-card prefix and purchase date", () => {
    strict_1.default.match((0, gift_card_utils_1.createGiftCardOrderNumber)(new Date("2026-08-15T00:00:00.000Z")), /^GC-20260815-[A-F0-9]{10}$/);
});
(0, node_test_1.default)("admin product input accepts URL or frontend asset-path metadata", () => {
    const parsed = gift_card_validation_1.createGiftCardSchema.parse({
        name: "Amazon Gift Card",
        slug: "amazon-gift-card",
        brand: "Amazon",
        imageUrl: "/images/gift-cards/amazon.png",
        currency: "usd",
    });
    strict_1.default.equal(parsed.currency, "USD");
});
(0, node_test_1.default)("denomination input rejects floating numbers and non-positive decimal strings", () => {
    strict_1.default.equal(gift_card_validation_1.createDenominationSchema.safeParse({ faceValue: 10, faceCurrency: "USD", sellingPriceBdt: "1280.00" }).success, false);
    strict_1.default.equal(gift_card_validation_1.createDenominationSchema.safeParse({ faceValue: "0", faceCurrency: "USD", sellingPriceBdt: "1280.00" }).success, false);
    strict_1.default.equal(gift_card_validation_1.createDenominationSchema.safeParse({ faceValue: "10.00", faceCurrency: "USD", sellingPriceBdt: "1280.00" }).success, true);
});
(0, node_test_1.default)("custom delivery requires and normalizes an email", () => {
    strict_1.default.equal(gift_card_validation_1.deliveryEmailSchema.safeParse({ useAccountEmail: false }).success, false);
    const parsed = gift_card_validation_1.deliveryEmailSchema.parse({ useAccountEmail: false, deliveryEmail: " Customer@Example.COM " });
    strict_1.default.equal(parsed.deliveryEmail, "customer@example.com");
});
(0, node_test_1.default)("bulk inventory validation rejects empty batches", () => {
    strict_1.default.equal(gift_card_validation_1.bulkInventoryCodeSchema.safeParse({ codes: [] }).success, false);
});
(0, node_test_1.default)("query validation works with the Express 5 getter-only query property", () => {
    const request = Object.create({});
    Object.defineProperty(request, "query", {
        get: () => ({ page: "2", limit: "5" }),
        configurable: true,
    });
    let nextError;
    (0, validate_middleware_1.validateRequest)({ query: gift_card_validation_2.publicGiftCardQuerySchema })(request, {}, (error) => {
        nextError = error;
    });
    strict_1.default.equal(nextError, undefined);
    strict_1.default.equal(request.query.page, 2);
    strict_1.default.equal(request.query.limit, 5);
});
(0, node_test_1.default)("customer role is denied by admin authorization middleware", () => {
    let nextError;
    (0, auth_middleware_1.authorizeRoles)(client_1.UserRole.ADMIN)({ authUser: { id: "customer", email: "customer@example.test", role: client_1.UserRole.CUSTOMER } }, {}, (error) => { nextError = error; });
    strict_1.default.ok(nextError instanceof apiAppError_1.ApiAppError);
    strict_1.default.equal(nextError.statusCode, 403);
});
