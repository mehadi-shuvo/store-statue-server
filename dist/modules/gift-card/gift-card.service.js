"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCardServices = void 0;
const client_1 = require("../../generated/prisma/client");
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
const include = {
    category: { select: { id: true, title: true, slug: true } },
    denominations: { orderBy: { sortOrder: "asc" } },
};
const positiveNumber = (value, field) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        throw new apiAppError_1.ApiAppError(400, `${field} must be greater than 0`);
    }
    return number;
};
const stockValue = (value, field) => {
    if (value === undefined || value === null)
        return value;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) {
        throw new apiAppError_1.ApiAppError(400, `${field} must be a non-negative integer or null`);
    }
    return number;
};
const normalizeDenominations = (payload) => {
    const values = payload.denominations ?? payload.amounts;
    if (!Array.isArray(values) || values.length === 0) {
        throw new apiAppError_1.ApiAppError(400, "Gift card denominations are required");
    }
    return values.map((item, index) => {
        const sellingPriceBDT = item.sellingPriceBDT ?? item.bdtPrice ?? item.BDT;
        const cardValue = item.cardValue ?? item.cardUSD;
        if (sellingPriceBDT == null || cardValue == null) {
            throw new apiAppError_1.ApiAppError(400, `Denomination at index ${index} requires sellingPriceBDT and cardValue`);
        }
        const discountPercent = item.discountPercent;
        if (discountPercent !== undefined &&
            (!Number.isFinite(Number(discountPercent)) ||
                Number(discountPercent) < 0 ||
                Number(discountPercent) > 100)) {
            throw new apiAppError_1.ApiAppError(400, `discountPercent at index ${index} must be 0-100`);
        }
        return {
            title: item.title,
            sellingPriceBDT: positiveNumber(sellingPriceBDT, `sellingPriceBDT at index ${index}`),
            cardValue: positiveNumber(cardValue, `cardValue at index ${index}`),
            cardCurrency: item.cardCurrency ?? payload.cardCurrency ?? "USD",
            costPriceBDT: item.costPriceBDT,
            discountAmountBDT: item.discountAmountBDT,
            discountPercent: item.discountPercent,
            discountLabel: item.discountLabel,
            isPopular: item.isPopular ?? item.popular ?? false,
            isActive: item.isActive ?? true,
            sortOrder: item.sortOrder ?? index,
            stockQuantity: stockValue(item.stockQuantity, `stockQuantity at index ${index}`),
        };
    });
};
const productData = (payload, userId) => ({
    ...(payload.brand !== undefined && { brand: payload.brand }),
    ...(payload.title !== undefined && { title: payload.title }),
    ...(payload.slug !== undefined && { slug: payload.slug }),
    ...(payload.description !== undefined && { description: payload.description }),
    ...(payload.image !== undefined && { image: payload.image }),
    ...(payload.thumbnail !== undefined && { image: payload.thumbnail }),
    ...(payload.bannerImage !== undefined && { bannerImage: payload.bannerImage }),
    ...(payload.cardCurrency !== undefined && { cardCurrency: payload.cardCurrency }),
    ...(payload.region !== undefined && { region: payload.region }),
    ...(payload.deliveryType !== undefined && { deliveryType: payload.deliveryType }),
    ...(payload.instructions !== undefined && { instructions: payload.instructions }),
    ...(payload.termsAndConditions !== undefined && {
        termsAndConditions: payload.termsAndConditions,
    }),
    ...(payload.status !== undefined && { status: payload.status }),
    ...(payload.isFeatured !== undefined && { isFeatured: payload.isFeatured }),
    ...(payload.sortOrder !== undefined && { sortOrder: payload.sortOrder }),
    ...(payload.categoryId !== undefined && { categoryId: payload.categoryId }),
    ...(userId && { updatedById: userId }),
});
const getGiftCards = async (query) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
    if (query.status && !Object.values(client_1.ProductStatus).includes(query.status)) {
        throw new apiAppError_1.ApiAppError(400, "Invalid product status");
    }
    const where = {
        deletedAt: null,
        status: query.status ?? "ACTIVE",
        ...(query.categoryId && { categoryId: query.categoryId }),
        ...(query.isFeatured !== undefined && {
            isFeatured: query.isFeatured === "true",
        }),
        ...(query.search && {
            OR: ["title", "brand", "slug"].map((field) => ({
                [field]: { contains: query.search, mode: "insensitive" },
            })),
        }),
    };
    const [data, total] = await prisma_client_1.prismaC.$transaction([
        prisma_client_1.prismaC.giftCardProduct.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            include,
        }),
        prisma_client_1.prismaC.giftCardProduct.count({ where }),
    ]);
    return { meta: { total, page, limit, totalPages: Math.ceil(total / limit) }, data };
};
const getGiftCardById = async (id, includeInactive = false) => {
    const result = await prisma_client_1.prismaC.giftCardProduct.findFirst({
        where: {
            OR: [{ id }, { slug: id }],
            deletedAt: null,
            ...(includeInactive ? {} : { status: client_1.ProductStatus.ACTIVE }),
        },
        include,
    });
    if (!result)
        throw new apiAppError_1.ApiAppError(404, "Gift card not found");
    return result;
};
const createGiftCard = async (payload, userId) => {
    const denominations = normalizeDenominations(payload);
    if (!payload.brand || !payload.title || !payload.slug) {
        throw new apiAppError_1.ApiAppError(400, "brand, title and slug are required");
    }
    const image = payload.image ?? payload.thumbnail;
    if (!image)
        throw new apiAppError_1.ApiAppError(400, "image is required");
    return prisma_client_1.prismaC.giftCardProduct.create({
        data: {
            ...productData(payload),
            brand: payload.brand,
            title: payload.title,
            slug: payload.slug,
            image,
            ...(userId && { createdById: userId, updatedById: userId }),
            denominations: { create: denominations },
        },
        include,
    });
};
const updateGiftCard = async (id, payload, userId) => {
    const existing = await getGiftCardById(id, true);
    const denominations = payload.denominations || payload.amounts ? normalizeDenominations(payload) : undefined;
    return prisma_client_1.prismaC.giftCardProduct.update({
        where: { id: existing.id },
        data: {
            ...productData(payload, userId),
            ...(denominations && {
                denominations: { deleteMany: {}, create: denominations },
            }),
        },
        include,
    });
};
const deleteGiftCard = async (id) => {
    const existing = await getGiftCardById(id, true);
    return prisma_client_1.prismaC.giftCardProduct.update({
        where: { id: existing.id },
        data: { status: "ARCHIVED", deletedAt: new Date() },
    });
};
exports.giftCardServices = {
    getGiftCards,
    getGiftCardById,
    createGiftCard,
    updateGiftCard,
    deleteGiftCard,
};
