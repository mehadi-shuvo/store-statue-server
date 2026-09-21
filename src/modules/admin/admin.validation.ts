import { z } from "zod";
import {
  DeliveryStatus,
  DigitalProductType,
  OrderStatus,
  PaymentStatus,
  UserRole,
} from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";

const emailSchema = z
  .string()
  .trim()
  .email("A valid email is required")
  .max(255, "Email is too long")
  .transform((email) => email.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

const phoneSchema = z
  .string()
  .trim()
  .min(6, "Phone number is too short")
  .max(20, "Phone number is too long")
  .regex(/^\+?[0-9\s-]+$/, "Phone number can only contain digits, spaces, hyphens, and an optional leading plus");

export const createAdminSchema = z
  .object({
    email: emailSchema,
    name: z.string().trim().min(2, "Name is required").max(80, "Name is too long"),
    phone: phoneSchema.optional(),
    password: passwordSchema,
    currentPassword: z.string().min(1, "Current password is required").max(128, "Current password is too long"),
  })
  .strict();

export const updateAdminProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(80, "Name is too long").optional(),
    phone: phoneSchema.nullable().optional(),
  })
  .strict()
  .refine((payload) => payload.name !== undefined || payload.phone !== undefined, {
    message: "At least one profile field is required",
  });

export const manageAdminProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(80, "Name is too long").optional(),
    phone: phoneSchema.nullable().optional(),
    currentPassword: z.string().min(1, "Current password is required").max(128, "Current password is too long"),
  })
  .strict()
  .refine((payload) => payload.name !== undefined || payload.phone !== undefined, {
    message: "At least one profile field is required",
  });

export const changeAdminPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(128, "Current password is too long"),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((payload) => payload.currentPassword !== payload.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export const verifyAdminActionSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(128, "Current password is too long"),
  })
  .strict();

export const updateUserStatusSchema = z
  .object({
    isDeleted: z.boolean(),
    reason: z.string().trim().min(3, "Reason is required").max(500, "Reason is too long"),
  })
  .strict();

export const resolveCustomerIssueSchema = z
  .object({
    note: z.string().trim().min(3, "Resolution note is required").max(1000, "Resolution note is too long"),
  })
  .strict();

export const updateOrderStatusSchema = z
  .object({
    status: z.nativeEnum(OrderStatus),
    notes: z.string().trim().max(1000, "Notes are too long").optional(),
  })
  .strict();

export const updateDeliveryStatusSchema = z
  .object({
    deliveryStatus: z.nativeEnum(DeliveryStatus),
    fulfillmentReference: z.string().trim().max(255, "Fulfillment reference is too long").nullable().optional(),
  })
  .strict();

export const verifyPaymentIssueSchema = z
  .object({
    paymentStatus: z.enum([PaymentStatus.REFUND_PENDING, PaymentStatus.REFUNDED, PaymentStatus.REFUND_FAILED]),
    failureReason: z.string().trim().min(3, "Resolution note is required").max(1000, "Resolution note is too long"),
  })
  .strict();

export const adminUserQuerySchema = z
  .object({
    role: z.nativeEnum(UserRole).optional(),
    status: z.enum(["active", "inactive", "all"]).optional(),
    search: z.string().trim().max(255).optional(),
  })
  .strict();

export const orderQuerySchema = z
  .object({
    status: z.nativeEnum(OrderStatus).optional(),
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    userId: z.string().trim().uuid().optional(),
    search: z.string().trim().max(255).optional(),
  })
  .strict();

export const deliveryQuerySchema = z
  .object({
    deliveryStatus: z.nativeEnum(DeliveryStatus).optional(),
  })
  .strict();

export const paymentQuerySchema = z
  .object({
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  })
  .strict();

export const dateRangeQuerySchema = z
  .object({
    from: z.string().trim().datetime({ offset: true }).optional(),
    to: z.string().trim().datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(
    (query) => !query.from || !query.to || new Date(query.from) <= new Date(query.to),
    { message: "from must be earlier than or equal to to", path: ["from"] },
  );

export const digitalProductQuerySchema = z
  .object({
    type: z.enum([
      DigitalProductType.GIFT_CARD,
      DigitalProductType.GAME_TOP_UP,
      DigitalProductType.SUBSCRIPTION,
    ]).optional(),
    isActive: z.enum(["true", "false"]).optional(),
    search: z.string().trim().max(255).optional(),
  })
  .strict();

export const logQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    level: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),
  })
  .strict();

export type CreateAdminPayload = z.infer<typeof createAdminSchema>;
export type UpdateAdminProfilePayload = z.infer<typeof updateAdminProfileSchema>;
export type ManageAdminProfilePayload = z.infer<typeof manageAdminProfileSchema>;
export type ChangeAdminPasswordPayload = z.infer<typeof changeAdminPasswordSchema>;
export type VerifyAdminActionPayload = z.infer<typeof verifyAdminActionSchema>;
export type UpdateUserStatusPayload = z.infer<typeof updateUserStatusSchema>;
export type ResolveCustomerIssuePayload = z.infer<typeof resolveCustomerIssueSchema>;
export type UpdateOrderStatusPayload = z.infer<typeof updateOrderStatusSchema>;
export type UpdateDeliveryStatusPayload = z.infer<typeof updateDeliveryStatusSchema>;
export type VerifyPaymentIssuePayload = z.infer<typeof verifyPaymentIssueSchema>;
export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type OrderQuery = z.infer<typeof orderQuerySchema>;
export type DeliveryQuery = z.infer<typeof deliveryQuerySchema>;
export type PaymentQuery = z.infer<typeof paymentQuerySchema>;
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type DigitalProductQuery = z.infer<typeof digitalProductQuerySchema>;
export type LogQuery = z.infer<typeof logQuerySchema>;

export const parseRequestBody = <T>(schema: z.ZodSchema<T>, body: unknown): T => {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new ApiAppError(
      400,
      "Invalid request body",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  return parsed.data;
};

export const parseRequestQuery = <T>(schema: z.ZodSchema<T>, query: unknown): T => {
  const parsed = schema.safeParse(query);

  if (!parsed.success) {
    throw new ApiAppError(
      400,
      "Invalid query parameters",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  return parsed.data;
};
