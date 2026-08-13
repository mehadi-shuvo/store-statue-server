"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentScenarioQuerySchema = exports.paymentParamsSchema = exports.executePaymentSchema = exports.createPaymentSchema = void 0;
const zod_1 = require("zod");
exports.createPaymentSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid("Invalid order id"),
    amount: zod_1.z.coerce.number().positive("Amount must be greater than 0"),
}).strict();
exports.executePaymentSchema = zod_1.z.object({
    paymentId: zod_1.z.string().min(1, "Payment id is required"),
}).strict();
exports.paymentParamsSchema = zod_1.z.object({
    paymentId: zod_1.z.string().min(1, "Payment id is required"),
}).strict();
exports.paymentScenarioQuerySchema = zod_1.z.object({
    scenario: zod_1.z.enum(["success", "failure", "cancel"]).optional(),
}).strict();
