"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionServices = void 0;
const client_1 = require("../../generated/prisma/client");
const apiAppError_1 = require("../../utils/apiAppError");
const prisma_client_1 = require("../../utils/prisma-client");
const include = {
    category: { select: { id: true, title: true, slug: true } },
    plans: { orderBy: { sortOrder: "asc" } },
    inputFields: { orderBy: { sortOrder: "asc" } },
};
const positiveNumber = (value, field) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        throw new apiAppError_1.ApiAppError(400, `${field} must be greater than 0`);
    }
    return number;
};
const optionalNonNegativeInteger = (value, field) => {
    if (value === undefined || value === null)
        return value;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) {
        throw new apiAppError_1.ApiAppError(400, `${field} must be a non-negative integer or null`);
    }
    return number;
};
const plansFrom = (payload) => {
    if (!Array.isArray(payload.plans) || payload.plans.length === 0) {
        throw new apiAppError_1.ApiAppError(400, "Subscription plans are required");
    }
    return payload.plans.map((plan, index) => {
        const sellingPriceBDT = plan.sellingPriceBDT ?? plan.price;
        if (!plan.title || sellingPriceBDT == null || !plan.billingCycle) {
            throw new apiAppError_1.ApiAppError(400, `Plan at index ${index} requires title, sellingPriceBDT and billingCycle`);
        }
        return {
            title: plan.title,
            description: plan.description,
            sellingPriceBDT: positiveNumber(sellingPriceBDT, `sellingPriceBDT at index ${index}`),
            costPriceBDT: plan.costPriceBDT,
            billingCycle: plan.billingCycle,
            durationDays: optionalNonNegativeInteger(plan.durationDays, `durationDays at index ${index}`),
            durationLabel: plan.durationLabel,
            maxDevices: optionalNonNegativeInteger(plan.maxDevices, `maxDevices at index ${index}`),
            maxUsers: optionalNonNegativeInteger(plan.maxUsers, `maxUsers at index ${index}`),
            screenCount: optionalNonNegativeInteger(plan.screenCount, `screenCount at index ${index}`),
            profileCount: optionalNonNegativeInteger(plan.profileCount, `profileCount at index ${index}`),
            accountType: plan.accountType,
            subscriptionTier: plan.subscriptionTier,
            features: plan.features ?? [],
            discountAmountBDT: plan.discountAmountBDT,
            discountPercent: plan.discountPercent,
            discountLabel: plan.discountLabel,
            isPopular: plan.isPopular ?? plan.popular ?? false,
            isActive: plan.isActive ?? true,
            sortOrder: plan.sortOrder ?? index,
            stockQuantity: optionalNonNegativeInteger(plan.stockQuantity, `stockQuantity at index ${index}`),
        };
    });
};
const inputFieldsFrom = (values = []) => values.map((item, index) => ({
    name: item.name,
    label: item.label,
    type: item.type ?? "TEXT",
    placeholder: item.placeholder,
    helpText: item.helpText,
    isRequired: item.isRequired ?? true,
    options: item.options,
    validationRules: item.validationRules,
    isActive: item.isActive ?? true,
    sortOrder: item.sortOrder ?? index,
}));
const productData = (p, userId) => ({
    ...(p.platformName !== undefined && { platformName: p.platformName }),
    ...(p.title !== undefined && { title: p.title }),
    ...(p.slug !== undefined && { slug: p.slug }),
    ...(p.subHeading !== undefined && { subHeading: p.subHeading }),
    ...(p.description !== undefined && { description: p.description }),
    ...(p.logo !== undefined && { logo: p.logo }),
    ...(p.image !== undefined && { logo: p.image }),
    ...(p.thumbnail !== undefined && { logo: p.thumbnail }),
    ...(p.bannerImage !== undefined && { bannerImage: p.bannerImage }),
    ...(p.deliveryType !== undefined && { deliveryType: p.deliveryType }),
    ...(p.instructions !== undefined && { instructions: p.instructions }),
    ...(p.estimatedDelivery !== undefined && { estimatedDelivery: p.estimatedDelivery }),
    ...(p.termsAndConditions !== undefined && { termsAndConditions: p.termsAndConditions }),
    ...(p.isRenewable !== undefined && { isRenewable: p.isRenewable }),
    ...(p.status !== undefined && { status: p.status }),
    ...(p.isFeatured !== undefined && { isFeatured: p.isFeatured }),
    ...(p.sortOrder !== undefined && { sortOrder: p.sortOrder }),
    ...(p.categoryId !== undefined && { categoryId: p.categoryId }),
    ...(userId && { updatedById: userId }),
});
const getSubscriptions = async (query) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
    if (query.status && !Object.values(client_1.ProductStatus).includes(query.status)) {
        throw new apiAppError_1.ApiAppError(400, "Invalid product status");
    }
    const where = {
        deletedAt: null,
        status: query.status ?? "ACTIVE",
        ...(query.categoryId && { categoryId: query.categoryId }),
        ...(query.isFeatured !== undefined && { isFeatured: query.isFeatured === "true" }),
        ...(query.search && {
            OR: ["platformName", "title", "slug"].map((field) => ({
                [field]: { contains: query.search, mode: "insensitive" },
            })),
        }),
    };
    const [data, total] = await prisma_client_1.prismaC.$transaction([
        prisma_client_1.prismaC.subscriptionProduct.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            include,
        }),
        prisma_client_1.prismaC.subscriptionProduct.count({ where }),
    ]);
    return { meta: { total, page, limit, totalPages: Math.ceil(total / limit) }, data };
};
const getSubscriptionById = async (id, includeInactive = false) => {
    const result = await prisma_client_1.prismaC.subscriptionProduct.findFirst({
        where: {
            OR: [{ id }, { slug: id }],
            deletedAt: null,
            ...(includeInactive ? {} : { status: client_1.ProductStatus.ACTIVE }),
        },
        include,
    });
    if (!result)
        throw new apiAppError_1.ApiAppError(404, "Subscription product not found");
    return result;
};
const createSubscription = async (payload, userId) => {
    const plans = plansFrom(payload);
    const logo = payload.logo ?? payload.image ?? payload.thumbnail;
    const platformName = payload.platformName ?? payload.title;
    if (!platformName || !payload.title || !payload.slug || !logo || !payload.deliveryType) {
        throw new apiAppError_1.ApiAppError(400, "platformName, title, slug, logo and deliveryType are required");
    }
    return prisma_client_1.prismaC.subscriptionProduct.create({
        data: {
            ...productData(payload),
            platformName,
            title: payload.title,
            slug: payload.slug,
            logo,
            deliveryType: payload.deliveryType,
            ...(userId && { createdById: userId, updatedById: userId }),
            plans: { create: plans },
            inputFields: { create: inputFieldsFrom(payload.inputFields) },
        },
        include,
    });
};
const updateSubscription = async (id, payload, userId) => {
    const existing = await getSubscriptionById(id, true);
    const plans = payload.plans ? plansFrom(payload) : undefined;
    const inputFields = payload.inputFields
        ? inputFieldsFrom(payload.inputFields)
        : undefined;
    return prisma_client_1.prismaC.subscriptionProduct.update({
        where: { id: existing.id },
        data: {
            ...productData(payload, userId),
            ...(plans && { plans: { deleteMany: {}, create: plans } }),
            ...(inputFields && { inputFields: { deleteMany: {}, create: inputFields } }),
        },
        include,
    });
};
const deleteSubscription = async (id) => {
    const existing = await getSubscriptionById(id, true);
    return prisma_client_1.prismaC.subscriptionProduct.update({
        where: { id: existing.id },
        data: { status: "ARCHIVED", deletedAt: new Date() },
    });
};
exports.subscriptionServices = {
    getSubscriptions,
    getSubscriptionById,
    createSubscription,
    updateSubscription,
    deleteSubscription,
};
