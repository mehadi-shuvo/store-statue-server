"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionServices = void 0;
const client_1 = require("../../generated/prisma/client");
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
const product_service_1 = require("../products/product.service");
const normalizePlans = (payload) => {
    if (!Array.isArray(payload.plans) || payload.plans.length === 0) {
        throw new apiAppError_1.ApiAppError(400, "Subscription plans are required");
    }
    return payload.plans.map((plan, index) => {
        if (!plan.title || !plan.price) {
            throw new apiAppError_1.ApiAppError(400, `Subscription plan at index ${index} must include title and price`);
        }
        return {
            title: plan.title,
            price: plan.price,
            durationDays: plan.durationDays,
            durationLabel: plan.durationLabel,
            isPopular: plan.isPopular ?? plan.popular ?? false,
            stockQuantity: plan.stockQuantity,
            sortOrder: plan.sortOrder ?? index,
            isActive: plan.isActive ?? true,
        };
    });
};
const buildProductPayload = (payload) => {
    const plans = normalizePlans(payload);
    const lowestPrice = Math.min(...plans.map((plan) => plan.price));
    const image = payload.thumbnail || payload.image;
    return {
        title: payload.title,
        slug: payload.slug,
        description: payload.description,
        subHeading: payload.subHeading,
        brand: payload.platformName || payload.title,
        type: client_1.ProductType.SUBSCRIPTION,
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
        subscription: {
            platformName: payload.platformName || payload.title,
            instructions: payload.instructions,
            isRenewable: payload.isRenewable ?? true,
            plans,
            inputFields: payload.inputFields || [
                {
                    name: "accountEmail",
                    label: "Account Email",
                    type: "EMAIL",
                    isRequired: true,
                    sortOrder: 0,
                },
            ],
        },
    };
};
const getSubscriptions = async (query) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Number(query.limit) || 12, 100);
    const skip = (page - 1) * limit;
    const where = {
        type: client_1.ProductType.SUBSCRIPTION,
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
                subscription: {
                    include: {
                        plans: {
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
const getSubscriptionById = async (id) => {
    const product = await prisma_client_1.prismaC.product.findFirst({
        where: {
            id,
            type: client_1.ProductType.SUBSCRIPTION,
            isActive: true,
        },
        include: {
            category: { select: { id: true, title: true } },
            subscription: {
                include: {
                    plans: {
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
        throw new apiAppError_1.ApiAppError(404, "Subscription product not found");
    }
    return product;
};
const createSubscription = async (payload, adminUserId) => {
    return product_service_1.productServices.addProduct(buildProductPayload(payload), adminUserId);
};
const updateSubscription = async (id, payload, adminUserId) => {
    await getSubscriptionById(id);
    const productPayload = payload.plans
        ? buildProductPayload(payload)
        : {
            ...payload,
            brand: payload.platformName,
            type: client_1.ProductType.SUBSCRIPTION,
        };
    return product_service_1.productServices.updateProduct(id, productPayload, adminUserId);
};
const deleteSubscription = async (id) => {
    await getSubscriptionById(id);
    return product_service_1.productServices.deleteProduct(id);
};
exports.subscriptionServices = {
    getSubscriptions,
    getSubscriptionById,
    createSubscription,
    updateSubscription,
    deleteSubscription,
};
