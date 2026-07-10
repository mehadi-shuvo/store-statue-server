"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCardServices = void 0;
const client_1 = require("../../generated/prisma/client");
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
const product_service_1 = require("../products/product.service");
const getCardCurrency = (payload) => {
    if (payload.cardCurrency) {
        return payload.cardCurrency;
    }
    if (payload.currency === "$") {
        return "USD";
    }
    return payload.currency || "USD";
};
const normalizeDenominations = (payload) => {
    const source = payload.denominations || payload.amounts || [];
    if (!Array.isArray(source) || source.length === 0) {
        throw new apiAppError_1.ApiAppError(400, "Gift card amounts are required");
    }
    const cardCurrency = getCardCurrency(payload);
    return source.map((amount, index) => {
        const bdtPrice = amount.bdtPrice ?? amount.BDT;
        const cardValue = amount.cardValue ?? amount.cardUSD;
        if (!bdtPrice || !cardValue) {
            throw new apiAppError_1.ApiAppError(400, `Gift card amount at index ${index} must include BDT and card value`);
        }
        return {
            title: amount.title || `${cardCurrency} ${cardValue}`,
            bdtPrice,
            cardValue,
            cardCurrency,
            isPopular: amount.isPopular ?? amount.popular ?? false,
            stockQuantity: amount.stockQuantity,
            sortOrder: amount.sortOrder ?? index,
            isActive: amount.isActive ?? true,
        };
    });
};
const buildProductPayload = (payload) => {
    const denominations = normalizeDenominations(payload);
    const lowestPrice = Math.min(...denominations.map((amount) => amount.bdtPrice));
    const image = payload.thumbnail || payload.image;
    return {
        title: payload.title,
        slug: payload.slug,
        description: payload.description,
        subHeading: payload.subHeading,
        brand: payload.brand,
        type: client_1.ProductType.GIFT_CARD,
        price: payload.price ?? lowestPrice,
        stockQuantity: payload.stockQuantity ?? 999999,
        categoryId: payload.categoryId,
        offerPercent: payload.offerPercent,
        photos: payload.photos || (image ? [image] : []),
        thumbnail: image,
        bannerImage: payload.bannerImage,
        features: payload.features,
        currency: "BDT",
        sortOrder: payload.sortOrder,
        giftCard: {
            brand: payload.brand,
            cardCurrency: getCardCurrency(payload),
            denominations,
        },
    };
};
const getGiftCards = async (query) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Number(query.limit) || 12, 100);
    const skip = (page - 1) * limit;
    const where = {
        type: client_1.ProductType.GIFT_CARD,
        isActive: true,
    };
    const [products, total] = await prisma_client_1.prismaC.$transaction([
        prisma_client_1.prismaC.product.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                category: { select: { id: true, title: true } },
                giftCard: {
                    include: {
                        denominations: {
                            where: { isActive: true },
                            orderBy: { sortOrder: "asc" },
                        },
                    },
                },
            },
        }),
        prisma_client_1.prismaC.product.count({ where }),
    ]);
    return {
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
        data: products,
    };
};
const getGiftCardById = async (id) => {
    const product = await prisma_client_1.prismaC.product.findFirst({
        where: {
            id,
            type: client_1.ProductType.GIFT_CARD,
            isActive: true,
        },
        include: {
            category: { select: { id: true, title: true } },
            giftCard: {
                include: {
                    denominations: {
                        where: { isActive: true },
                        orderBy: { sortOrder: "asc" },
                    },
                },
            },
        },
    });
    if (!product) {
        throw new apiAppError_1.ApiAppError(404, "Gift card not found");
    }
    return product;
};
const createGiftCard = async (payload, adminUserId) => {
    return product_service_1.productServices.addProduct(buildProductPayload(payload), adminUserId);
};
const updateGiftCard = async (id, payload, adminUserId) => {
    await getGiftCardById(id);
    const productPayload = payload.amounts || payload.denominations
        ? buildProductPayload(payload)
        : {
            ...payload,
            type: client_1.ProductType.GIFT_CARD,
            brand: payload.brand,
        };
    return product_service_1.productServices.updateProduct(id, productPayload, adminUserId);
};
const deleteGiftCard = async (id) => {
    await getGiftCardById(id);
    return product_service_1.productServices.deleteProduct(id);
};
exports.giftCardServices = {
    getGiftCards,
    getGiftCardById,
    createGiftCard,
    updateGiftCard,
    deleteGiftCard,
};
