"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameTopUpServices = void 0;
const client_1 = require("../../generated/prisma/client");
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
const product_service_1 = require("../products/product.service");
const normalizePackages = (payload) => {
    const source = payload.packages || payload.topUpAmounts || [];
    if (!Array.isArray(source) || source.length === 0) {
        throw new apiAppError_1.ApiAppError(400, "Top-up packages are required");
    }
    return source.map((amount, index) => {
        const price = amount.price ?? amount.realCurrency;
        const gameCurrencyAmount = amount.gameCurrencyAmount ?? amount.gameCurrency;
        if (!price || !gameCurrencyAmount) {
            throw new apiAppError_1.ApiAppError(400, `Top-up amount at index ${index} must include price and game currency`);
        }
        return {
            title: amount.title || `${gameCurrencyAmount} ${payload.gameCurrencyName}`,
            price,
            gameCurrencyAmount,
            isPopular: amount.isPopular ?? amount.popular ?? false,
            stockQuantity: amount.stockQuantity,
            sortOrder: amount.sortOrder ?? index,
            isActive: amount.isActive ?? true,
        };
    });
};
const buildProductPayload = (payload) => {
    const packages = normalizePackages(payload);
    const lowestPrice = Math.min(...packages.map((amount) => amount.price));
    const title = payload.title || payload.name;
    const image = payload.logo || payload.image;
    if (!title) {
        throw new apiAppError_1.ApiAppError(400, "Top-up title or name is required");
    }
    return {
        title,
        slug: payload.slug,
        description: payload.description,
        subHeading: payload.subHeading,
        brand: payload.name || title,
        type: client_1.ProductType.GAME_TOP_UP,
        price: payload.price ?? lowestPrice,
        stockQuantity: payload.stockQuantity ?? 999999,
        categoryId: payload.categoryId,
        offerPercent: payload.offerPercent,
        photos: payload.photos || (image ? [image] : []),
        thumbnail: image,
        bannerImage: payload.banner,
        features: payload.features,
        currency: "BDT",
        sortOrder: payload.sortOrder,
        gameTopUp: {
            gameName: payload.name || title,
            gameCurrencyName: payload.gameCurrencyName,
            instructions: payload.instructions,
            packages,
            inputFields: payload.inputFields || [
                {
                    name: "playerId",
                    label: "Player ID",
                    type: "TEXT",
                    isRequired: true,
                    sortOrder: 0,
                },
            ],
        },
    };
};
const getTopUps = async (query) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Number(query.limit) || 12, 100);
    const skip = (page - 1) * limit;
    const where = {
        type: client_1.ProductType.GAME_TOP_UP,
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
                gameTopUp: {
                    include: {
                        packages: {
                            where: { isActive: true },
                            orderBy: { sortOrder: "asc" },
                        },
                        inputFields: {
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
const getTopUpById = async (id) => {
    const product = await prisma_client_1.prismaC.product.findFirst({
        where: {
            id,
            type: client_1.ProductType.GAME_TOP_UP,
            isActive: true,
        },
        include: {
            category: { select: { id: true, title: true } },
            gameTopUp: {
                include: {
                    packages: {
                        where: { isActive: true },
                        orderBy: { sortOrder: "asc" },
                    },
                    inputFields: {
                        where: { isActive: true },
                        orderBy: { sortOrder: "asc" },
                    },
                },
            },
        },
    });
    if (!product) {
        throw new apiAppError_1.ApiAppError(404, "Top-up product not found");
    }
    return product;
};
const createTopUp = async (payload, adminUserId) => {
    return product_service_1.productServices.addProduct(buildProductPayload(payload), adminUserId);
};
const updateTopUp = async (id, payload, adminUserId) => {
    await getTopUpById(id);
    const productPayload = payload.packages || payload.topUpAmounts
        ? buildProductPayload(payload)
        : {
            ...payload,
            title: payload.title || payload.name,
            brand: payload.name,
            type: client_1.ProductType.GAME_TOP_UP,
        };
    return product_service_1.productServices.updateProduct(id, productPayload, adminUserId);
};
const deleteTopUp = async (id) => {
    await getTopUpById(id);
    return product_service_1.productServices.deleteProduct(id);
};
exports.gameTopUpServices = {
    getTopUps,
    getTopUpById,
    createTopUp,
    updateTopUp,
    deleteTopUp,
};
