import { z } from "zod";
import {
  GiftCardCodeStatus,
  GiftCardDeliveryType,
  GiftCardRegion,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  Prisma,
} from "../../generated/prisma/client";

const id = z.string().trim().uuid("A valid id is required");
const decimal = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, "Use a positive decimal with at most 2 places").refine((value) => new Prisma.Decimal(value).gt(0), "Value must be greater than 0");
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code");
const email = z.string().trim().email().max(255).transform((value) => value.toLowerCase());
const dateValue = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "A valid date is required");

export const idParamsSchema = z.object({ id }).strict();
export const giftCardIdParamsSchema = z.object({ giftCardId: id }).strict();
export const denominationIdParamsSchema = z.object({ denominationId: id }).strict();
export const codeIdParamsSchema = z.object({ codeId: id }).strict();
export const orderIdParamsSchema = z.object({ orderId: id }).strict();
export const cartItemIdParamsSchema = z.object({ cartItemId: id }).strict();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const publicGiftCardQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  brand: z.string().trim().max(100).optional(),
  minPriceBdt: decimal.optional(),
  maxPriceBdt: decimal.optional(),
  faceValue: decimal.optional(),
}).refine((query) => !query.minPriceBdt || !query.maxPriceBdt || new Prisma.Decimal(query.minPriceBdt).lte(query.maxPriceBdt), {
  message: "minPriceBdt must not exceed maxPriceBdt",
  path: ["minPriceBdt"],
});

export const adminGiftCardQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  brand: z.string().trim().max(100).optional(),
});

export const createGiftCardSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  brand: z.string().trim().min(1).max(100),
  description: z.string().trim().max(10000).optional(),
  shortDescription: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().min(1).max(2048),
  logoUrl: z.string().trim().max(2048).optional(),
  bannerImage: z.string().trim().max(2048).optional(),
  termsAndConditions: z.string().trim().max(20000).optional(),
  instructions: z.string().trim().max(10000).optional(),
  currency,
  region: z.nativeEnum(GiftCardRegion).optional(),
  deliveryType: z.nativeEnum(GiftCardDeliveryType).optional(),
  categoryId: id.optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

export const updateGiftCardSchema = createGiftCardSchema.partial().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const createDenominationSchema = z.object({
  faceValue: decimal,
  faceCurrency: currency,
  sellingPriceBdt: decimal,
  title: z.string().trim().max(120).optional(),
  costPriceBdt: decimal.optional(),
  isPopular: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

export const updateDenominationSchema = createDenominationSchema.partial().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const inventoryCodeSchema = z.object({
  code: z.string().trim().min(4).max(500),
  pin: z.string().trim().min(1).max(255).nullable().optional(),
  serialNumber: z.string().trim().min(1).max(255).nullable().optional(),
  expiryDate: dateValue.nullable().optional(),
}).strict();

export const bulkInventoryCodeSchema = z.object({
  codes: z.array(inventoryCodeSchema).min(1).max(500),
}).strict();

export const inventoryQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(GiftCardCodeStatus).optional(),
  expiryBefore: dateValue.optional(),
  expiryAfter: dateValue.optional(),
});

export const updateInventoryCodeSchema = inventoryCodeSchema.partial().extend({
  status: z.nativeEnum(GiftCardCodeStatus).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const cartGiftCardItemSchema = z.object({
  denominationId: id,
  quantity: z.number().int().min(1).max(20).default(1),
}).strict();

export const updateCartGiftCardItemSchema = z.object({
  quantity: z.number().int().min(1).max(20),
}).strict();

export const deliveryEmailSchema = z.object({
  deliveryEmail: email.optional(),
  useAccountEmail: z.boolean().default(true),
}).strict().superRefine((value, context) => {
  if (!value.useAccountEmail && !value.deliveryEmail) {
    context.addIssue({ code: "custom", path: ["deliveryEmail"], message: "Delivery email is required" });
  }
});

export const instantBuySchema = deliveryEmailSchema.safeExtend({
  denominationId: id,
  quantity: z.number().int().min(1).max(20).default(1),
});

export const buyNowSchema = z.object({
  // Accepts a denomination id, or a product id when it has exactly one active denomination.
  productId: id,
  quantity: z.number().int().min(1).max(20).default(1),
}).strict();

export const giftCardOrderQuerySchema = paginationSchema;

export const adminGiftCardOrderQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(OrderStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  email: z.string().trim().max(255).optional(),
  orderNumber: z.string().trim().max(100).optional(),
  from: dateValue.optional(),
  to: dateValue.optional(),
});

export type CreateGiftCardInput = z.infer<typeof createGiftCardSchema>;
export type UpdateGiftCardInput = z.infer<typeof updateGiftCardSchema>;
export type CreateDenominationInput = z.infer<typeof createDenominationSchema>;
export type UpdateDenominationInput = z.infer<typeof updateDenominationSchema>;
export type InventoryCodeInput = z.infer<typeof inventoryCodeSchema>;
export type UpdateInventoryCodeInput = z.infer<typeof updateInventoryCodeSchema>;
export type PurchaseInput = z.infer<typeof instantBuySchema>;
