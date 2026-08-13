"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRequestQuery = exports.parseRequestBody = exports.logQuerySchema = exports.digitalProductQuerySchema = exports.dateRangeQuerySchema = exports.paymentQuerySchema = exports.deliveryQuerySchema = exports.orderQuerySchema = exports.adminUserQuerySchema = exports.verifyPaymentIssueSchema = exports.updateDeliveryStatusSchema = exports.updateOrderStatusSchema = exports.resolveCustomerIssueSchema = exports.updateUserStatusSchema = exports.verifyAdminActionSchema = exports.changeAdminPasswordSchema = exports.manageAdminProfileSchema = exports.updateAdminProfileSchema = exports.createAdminSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("../../generated/prisma/client");
const apiAppError_1 = require("../../utils/apiAppError");
const emailSchema = zod_1.z
    .string()
    .trim()
    .email("A valid email is required")
    .max(255, "Email is too long")
    .transform((email) => email.toLowerCase());
const passwordSchema = zod_1.z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a special character");
const phoneSchema = zod_1.z
    .string()
    .trim()
    .min(6, "Phone number is too short")
    .max(20, "Phone number is too long")
    .regex(/^\+?[0-9\s-]+$/, "Phone number can only contain digits, spaces, hyphens, and an optional leading plus");
exports.createAdminSchema = zod_1.z
    .object({
    email: emailSchema,
    name: zod_1.z.string().trim().min(2, "Name is required").max(80, "Name is too long"),
    phone: phoneSchema.optional(),
    password: passwordSchema,
    currentPassword: zod_1.z.string().min(1, "Current password is required").max(128, "Current password is too long"),
})
    .strict();
exports.updateAdminProfileSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(2, "Name is required").max(80, "Name is too long").optional(),
    phone: phoneSchema.nullable().optional(),
})
    .strict()
    .refine((payload) => payload.name !== undefined || payload.phone !== undefined, {
    message: "At least one profile field is required",
});
exports.manageAdminProfileSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(2, "Name is required").max(80, "Name is too long").optional(),
    phone: phoneSchema.nullable().optional(),
    currentPassword: zod_1.z.string().min(1, "Current password is required").max(128, "Current password is too long"),
})
    .strict()
    .refine((payload) => payload.name !== undefined || payload.phone !== undefined, {
    message: "At least one profile field is required",
});
exports.changeAdminPasswordSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1, "Current password is required").max(128, "Current password is too long"),
    newPassword: passwordSchema,
})
    .strict()
    .refine((payload) => payload.currentPassword !== payload.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
});
exports.verifyAdminActionSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1, "Current password is required").max(128, "Current password is too long"),
})
    .strict();
exports.updateUserStatusSchema = zod_1.z
    .object({
    isDeleted: zod_1.z.boolean(),
    reason: zod_1.z.string().trim().min(3, "Reason is required").max(500, "Reason is too long"),
})
    .strict();
exports.resolveCustomerIssueSchema = zod_1.z
    .object({
    note: zod_1.z.string().trim().min(3, "Resolution note is required").max(1000, "Resolution note is too long"),
})
    .strict();
exports.updateOrderStatusSchema = zod_1.z
    .object({
    status: zod_1.z.nativeEnum(client_1.OrderStatus),
    notes: zod_1.z.string().trim().max(1000, "Notes are too long").optional(),
})
    .strict();
exports.updateDeliveryStatusSchema = zod_1.z
    .object({
    deliveryStatus: zod_1.z.nativeEnum(client_1.DeliveryStatus),
    fulfillmentReference: zod_1.z.string().trim().max(255, "Fulfillment reference is too long").nullable().optional(),
})
    .strict();
exports.verifyPaymentIssueSchema = zod_1.z
    .object({
    paymentStatus: zod_1.z.nativeEnum(client_1.PaymentStatus),
    transactionId: zod_1.z.string().trim().max(255, "Transaction id is too long").nullable().optional(),
    providerPaymentId: zod_1.z.string().trim().max(255, "Provider payment id is too long").nullable().optional(),
    failureReason: zod_1.z.string().trim().max(1000, "Failure reason is too long").nullable().optional(),
    rawResponse: zod_1.z.unknown().optional(),
})
    .strict();
exports.adminUserQuerySchema = zod_1.z
    .object({
    role: zod_1.z.nativeEnum(client_1.UserRole).optional(),
    status: zod_1.z.enum(["active", "inactive", "all"]).optional(),
    search: zod_1.z.string().trim().max(255).optional(),
})
    .strict();
exports.orderQuerySchema = zod_1.z
    .object({
    status: zod_1.z.nativeEnum(client_1.OrderStatus).optional(),
    paymentStatus: zod_1.z.nativeEnum(client_1.PaymentStatus).optional(),
    userId: zod_1.z.string().trim().uuid().optional(),
    search: zod_1.z.string().trim().max(255).optional(),
})
    .strict();
exports.deliveryQuerySchema = zod_1.z
    .object({
    deliveryStatus: zod_1.z.nativeEnum(client_1.DeliveryStatus).optional(),
})
    .strict();
exports.paymentQuerySchema = zod_1.z
    .object({
    paymentStatus: zod_1.z.nativeEnum(client_1.PaymentStatus).optional(),
})
    .strict();
exports.dateRangeQuerySchema = zod_1.z
    .object({
    from: zod_1.z.string().trim().datetime({ offset: true }).optional(),
    to: zod_1.z.string().trim().datetime({ offset: true }).optional(),
})
    .strict()
    .refine((query) => !query.from || !query.to || new Date(query.from) <= new Date(query.to), { message: "from must be earlier than or equal to to", path: ["from"] });
exports.digitalProductQuerySchema = zod_1.z
    .object({
    type: zod_1.z.enum([
        client_1.DigitalProductType.GIFT_CARD,
        client_1.DigitalProductType.GAME_TOP_UP,
        client_1.DigitalProductType.SUBSCRIPTION,
    ]).optional(),
    isActive: zod_1.z.enum(["true", "false"]).optional(),
    search: zod_1.z.string().trim().max(255).optional(),
})
    .strict();
exports.logQuerySchema = zod_1.z
    .object({
    limit: zod_1.z.coerce.number().int().min(1).max(500).optional(),
    level: zod_1.z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),
})
    .strict();
const parseRequestBody = (schema, body) => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        throw new apiAppError_1.ApiAppError(400, "Invalid request body", parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
        })));
    }
    return parsed.data;
};
exports.parseRequestBody = parseRequestBody;
const parseRequestQuery = (schema, query) => {
    const parsed = schema.safeParse(query);
    if (!parsed.success) {
        throw new apiAppError_1.ApiAppError(400, "Invalid query parameters", parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
        })));
    }
    return parsed.data;
};
exports.parseRequestQuery = parseRequestQuery;
