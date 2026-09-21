import { z } from "zod";
import {
  DeliveryStatus,
  GameTopUpFulfillmentType,
  PaymentStatus,
  ProductInputType,
  ProductStatus,
  Prisma,
} from "../../generated/prisma/client";

const id = z.string().trim().uuid("A valid id is required");
const slug = z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const decimal = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, "Use a non-negative decimal with at most 2 places");
const positiveDecimal = decimal.refine((value) => new Prisma.Decimal(value).gt(0), "Value must be greater than 0");
const dateValue = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "A valid date is required");

const safeFieldName = z.string().trim().min(1).max(64)
  .regex(/^[a-z][a-zA-Z0-9_]*$/, "Use a camelCase or snake_case field key")
  .refine((value) => !/(password|passcode|secret|otp|authToken|accessToken)/i.test(value), "Credential or secret fields are forbidden");

const safeFieldLabel = z.string().trim().min(1).max(100)
  .refine((value) => !/(password|passcode|facebook login|google login|gmail login)/i.test(value), "Third-party credential fields are forbidden");

const optionSchema = z.object({
  label: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(100),
}).strict();

const validationRulesSchema = z.object({
  minLength: z.number().int().min(1).max(500).optional(),
  maxLength: z.number().int().min(1).max(500).optional(),
  pattern: z.string().max(300).optional(),
  patternMessage: z.string().trim().max(200).optional(),
}).strict().refine((rules) => !rules.minLength || !rules.maxLength || rules.minLength <= rules.maxLength, {
  message: "minLength must not exceed maxLength",
  path: ["minLength"],
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const gameIdParamsSchema = z.object({ gameId: id }).strict();
export const slugParamsSchema = z.object({ slug }).strict();
export const packageIdParamsSchema = z.object({ packageId: id }).strict();
export const accountFieldIdParamsSchema = z.object({ fieldId: id }).strict();
export const orderIdParamsSchema = z.object({ orderId: id }).strict();

export const publicGameQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  categoryId: id.optional(),
});

export const adminGameQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  categoryId: id.optional(),
  status: z.nativeEnum(ProductStatus).optional(),
});

export const createGameSchema = z.object({
  name: z.string().trim().min(2).max(150),
  title: z.string().trim().min(2).max(150).optional(),
  slug,
  description: z.string().trim().max(10000).optional(),
  subHeading: z.string().trim().max(500).optional(),
  logoUrl: z.string().trim().min(1).max(2048),
  bannerUrl: z.string().trim().max(2048).optional(),
  gameCurrencyName: z.string().trim().min(1).max(50),
  fulfillmentType: z.nativeEnum(GameTopUpFulfillmentType),
  instructions: z.string().trim().max(10000).optional(),
  estimatedDelivery: z.string().trim().max(255).optional(),
  termsAndConditions: z.string().trim().max(20000).optional(),
  categoryId: id.optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

export const updateGameSchema = createGameSchema.partial().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const createPackageSchema = z.object({
  name: z.string().trim().min(1).max(150),
  providerProductId: z.string().trim().min(1).max(255).optional(),
  coinAmount: z.number().int().positive(),
  bonusAmount: z.number().int().min(0).optional(),
  priceBdt: positiveDecimal,
  costPriceBdt: positiveDecimal.optional(),
  discountAmountBdt: positiveDecimal.optional(),
  discountPercent: positiveDecimal.refine((value) => new Prisma.Decimal(value).lte(100), "Discount must not exceed 100").optional(),
  discountLabel: z.string().trim().max(100).optional(),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  stockQuantity: z.number().int().min(0).nullable().optional(),
}).strict();

export const updatePackageSchema = createPackageSchema.partial().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const createAccountFieldSchema = z.object({
  key: safeFieldName,
  label: safeFieldLabel,
  type: z.nativeEnum(ProductInputType).optional(),
  placeholder: z.string().trim().max(255).optional(),
  helpText: z.string().trim().max(500).optional(),
  required: z.boolean().optional(),
  options: z.array(optionSchema).min(1).max(100).optional(),
  validationRules: validationRulesSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict().superRefine((value, context) => {
  if ((value.type === ProductInputType.SELECT || value.type === ProductInputType.RADIO) && !value.options?.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Options are required for select and radio fields" });
  }
});

export const updateAccountFieldSchema = createAccountFieldSchema.partial().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const createTopUpOrderSchema = z.object({
  gameId: id.optional(),
  packageId: id,
  accountDetails: z.record(z.string(), z.unknown()),
}).strict();

export const topUpStatusSchema = z.enum([
  "PENDING",
  "QUEUED",
  "PROCESSING",
  "PROVIDER_PENDING",
  "COMPLETED",
  "FAILED",
  "FAILED_RETRYABLE",
  "FAILED_FINAL",
  "MANUAL_REVIEW",
  "CANCELLED",
]);

export const customerOrderQuerySchema = paginationSchema.extend({
  status: topUpStatusSchema.optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
});

export const adminOrderQuerySchema = paginationSchema.extend({
  status: topUpStatusSchema.optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  gameId: id.optional(),
  userId: id.optional(),
  serial: z.coerce.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
});

export const completeOrderSchema = z.object({
  previousBalance: decimal,
  currentBalance: decimal,
  customerMessage: z.string().trim().min(1).max(1000).optional(),
  internalAdminNote: z.string().trim().max(2000).optional(),
}).strict();

export const failOrderSchema = z.object({
  reason: z.enum(["INVALID_PLAYER_ID", "ACCOUNT_NOT_FOUND", "REGION_MISMATCH", "OTHER"]),
  customerMessage: z.string().trim().min(3).max(1000),
  internalAdminNote: z.string().trim().max(2000).optional(),
}).strict();

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;
export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type CreateAccountFieldInput = z.infer<typeof createAccountFieldSchema>;
export type UpdateAccountFieldInput = z.infer<typeof updateAccountFieldSchema>;
export type CreateTopUpOrderInput = z.infer<typeof createTopUpOrderSchema>;
export type CompleteTopUpOrderInput = z.infer<typeof completeOrderSchema>;
export type FailTopUpOrderInput = z.infer<typeof failOrderSchema>;
