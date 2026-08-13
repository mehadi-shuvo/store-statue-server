import { z } from "zod";
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
  .regex(/^\+?[0-9\s-]+$/, "Phone number can only contain digits, spaces, hyphens, and an optional leading plus")
  .optional();

export const createCustomerSchema = z
  .object({
    email: emailSchema,
    name: z.string().trim().min(2, "Name is required").max(80, "Name is too long"),
    phone: phoneSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "Password is required").max(128, "Password is too long"),
  })
  .strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    otp: z.string().trim().regex(/^\d{6}$/, "OTP must be a 6-digit code"),
    newPassword: passwordSchema,
  })
  .strict();

export const updateCustomerProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(80, "Name is too long").optional(),
    phone: phoneSchema.nullable(),
  })
  .strict()
  .refine((payload) => payload.name !== undefined || payload.phone !== undefined, {
    message: "At least one profile field is required",
  });

export const deleteCustomerProfileSchema = z
  .object({
    password: z.string().min(1, "Password is required").max(128, "Password is too long"),
  })
  .strict();

export type CreateCustomerPayload = z.infer<typeof createCustomerSchema>;
export type LoginPayload = z.infer<typeof loginSchema>;
export type UpdateCustomerProfilePayload = z.infer<typeof updateCustomerProfileSchema>;
export type DeleteCustomerProfilePayload = z.infer<typeof deleteCustomerProfileSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordSchema>;

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
