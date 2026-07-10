"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRequestBody = exports.deleteCustomerProfileSchema = exports.updateCustomerProfileSchema = exports.loginSchema = exports.createCustomerSchema = void 0;
const zod_1 = require("zod");
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
    .regex(/^\+?[0-9\s-]+$/, "Phone number can only contain digits, spaces, hyphens, and an optional leading plus")
    .optional();
exports.createCustomerSchema = zod_1.z
    .object({
    email: emailSchema,
    name: zod_1.z.string().trim().min(2, "Name is required").max(80, "Name is too long"),
    phone: phoneSchema,
    password: passwordSchema,
})
    .strict();
exports.loginSchema = zod_1.z
    .object({
    email: emailSchema,
    password: zod_1.z.string().min(1, "Password is required").max(128, "Password is too long"),
})
    .strict();
exports.updateCustomerProfileSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(2, "Name is required").max(80, "Name is too long").optional(),
    phone: phoneSchema.nullable(),
})
    .strict()
    .refine((payload) => payload.name !== undefined || payload.phone !== undefined, {
    message: "At least one profile field is required",
});
exports.deleteCustomerProfileSchema = zod_1.z
    .object({
    password: zod_1.z.string().min(1, "Password is required").max(128, "Password is too long"),
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
