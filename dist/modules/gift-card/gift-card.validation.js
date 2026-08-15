"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminGiftCardOrderQuerySchema = exports.giftCardOrderQuerySchema = exports.instantBuySchema = exports.deliveryEmailSchema = exports.updateCartGiftCardItemSchema = exports.cartGiftCardItemSchema = exports.updateInventoryCodeSchema = exports.inventoryQuerySchema = exports.bulkInventoryCodeSchema = exports.inventoryCodeSchema = exports.updateDenominationSchema = exports.createDenominationSchema = exports.updateGiftCardSchema = exports.createGiftCardSchema = exports.adminGiftCardQuerySchema = exports.publicGiftCardQuerySchema = exports.paginationSchema = exports.cartItemIdParamsSchema = exports.orderIdParamsSchema = exports.codeIdParamsSchema = exports.denominationIdParamsSchema = exports.giftCardIdParamsSchema = exports.idParamsSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("../../generated/prisma/client");
const id = zod_1.z.string().trim().uuid("A valid id is required");
const decimal = zod_1.z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, "Use a positive decimal with at most 2 places").refine((value) => new client_1.Prisma.Decimal(value).gt(0), "Value must be greater than 0");
const currency = zod_1.z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code");
const email = zod_1.z.string().trim().email().max(255).transform((value) => value.toLowerCase());
const dateValue = zod_1.z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "A valid date is required");
exports.idParamsSchema = zod_1.z.object({ id }).strict();
exports.giftCardIdParamsSchema = zod_1.z.object({ giftCardId: id }).strict();
exports.denominationIdParamsSchema = zod_1.z.object({ denominationId: id }).strict();
exports.codeIdParamsSchema = zod_1.z.object({ codeId: id }).strict();
exports.orderIdParamsSchema = zod_1.z.object({ orderId: id }).strict();
exports.cartItemIdParamsSchema = zod_1.z.object({ cartItemId: id }).strict();
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
}).strict();
exports.publicGiftCardQuerySchema = exports.paginationSchema.extend({
    search: zod_1.z.string().trim().max(100).optional(),
    brand: zod_1.z.string().trim().max(100).optional(),
    minPriceBdt: decimal.optional(),
    maxPriceBdt: decimal.optional(),
    faceValue: decimal.optional(),
}).refine((query) => !query.minPriceBdt || !query.maxPriceBdt || new client_1.Prisma.Decimal(query.minPriceBdt).lte(query.maxPriceBdt), {
    message: "minPriceBdt must not exceed maxPriceBdt",
    path: ["minPriceBdt"],
});
exports.adminGiftCardQuerySchema = exports.paginationSchema.extend({
    search: zod_1.z.string().trim().max(100).optional(),
    status: zod_1.z.nativeEnum(client_1.ProductStatus).optional(),
    brand: zod_1.z.string().trim().max(100).optional(),
});
exports.createGiftCardSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(150),
    slug: zod_1.z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    brand: zod_1.z.string().trim().min(1).max(100),
    description: zod_1.z.string().trim().max(10000).optional(),
    shortDescription: zod_1.z.string().trim().max(500).optional(),
    imageUrl: zod_1.z.string().trim().min(1).max(2048),
    logoUrl: zod_1.z.string().trim().max(2048).optional(),
    bannerImage: zod_1.z.string().trim().max(2048).optional(),
    termsAndConditions: zod_1.z.string().trim().max(20000).optional(),
    instructions: zod_1.z.string().trim().max(10000).optional(),
    currency,
    region: zod_1.z.nativeEnum(client_1.GiftCardRegion).optional(),
    deliveryType: zod_1.z.nativeEnum(client_1.GiftCardDeliveryType).optional(),
    categoryId: id.optional(),
    isActive: zod_1.z.boolean().optional(),
    isFeatured: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().min(0).optional(),
}).strict();
exports.updateGiftCardSchema = exports.createGiftCardSchema.partial().refine((value) => Object.keys(value).length > 0, "At least one field is required");
exports.createDenominationSchema = zod_1.z.object({
    faceValue: decimal,
    faceCurrency: currency,
    sellingPriceBdt: decimal,
    title: zod_1.z.string().trim().max(120).optional(),
    costPriceBdt: decimal.optional(),
    isPopular: zod_1.z.boolean().optional(),
    isActive: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().min(0).optional(),
}).strict();
exports.updateDenominationSchema = exports.createDenominationSchema.partial().refine((value) => Object.keys(value).length > 0, "At least one field is required");
exports.inventoryCodeSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(4).max(500),
    pin: zod_1.z.string().trim().min(1).max(255).nullable().optional(),
    serialNumber: zod_1.z.string().trim().min(1).max(255).nullable().optional(),
    expiryDate: dateValue.nullable().optional(),
}).strict();
exports.bulkInventoryCodeSchema = zod_1.z.object({
    codes: zod_1.z.array(exports.inventoryCodeSchema).min(1).max(500),
}).strict();
exports.inventoryQuerySchema = exports.paginationSchema.extend({
    status: zod_1.z.nativeEnum(client_1.GiftCardCodeStatus).optional(),
    expiryBefore: dateValue.optional(),
    expiryAfter: dateValue.optional(),
});
exports.updateInventoryCodeSchema = exports.inventoryCodeSchema.partial().extend({
    status: zod_1.z.nativeEnum(client_1.GiftCardCodeStatus).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");
exports.cartGiftCardItemSchema = zod_1.z.object({
    denominationId: id,
    quantity: zod_1.z.number().int().min(1).max(20).default(1),
}).strict();
exports.updateCartGiftCardItemSchema = zod_1.z.object({
    quantity: zod_1.z.number().int().min(1).max(20),
}).strict();
exports.deliveryEmailSchema = zod_1.z.object({
    deliveryEmail: email.optional(),
    useAccountEmail: zod_1.z.boolean().default(true),
}).strict().superRefine((value, context) => {
    if (!value.useAccountEmail && !value.deliveryEmail) {
        context.addIssue({ code: "custom", path: ["deliveryEmail"], message: "Delivery email is required" });
    }
});
exports.instantBuySchema = exports.deliveryEmailSchema.safeExtend({
    denominationId: id,
    quantity: zod_1.z.number().int().min(1).max(20).default(1),
});
exports.giftCardOrderQuerySchema = exports.paginationSchema;
exports.adminGiftCardOrderQuerySchema = exports.paginationSchema.extend({
    status: zod_1.z.nativeEnum(client_1.OrderStatus).optional(),
    paymentStatus: zod_1.z.nativeEnum(client_1.PaymentStatus).optional(),
    email: zod_1.z.string().trim().max(255).optional(),
    orderNumber: zod_1.z.string().trim().max(100).optional(),
    from: dateValue.optional(),
    to: dateValue.optional(),
});
