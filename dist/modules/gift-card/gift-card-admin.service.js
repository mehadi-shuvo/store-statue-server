"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCardAdminService = void 0;
const client_1 = require("../../generated/prisma/client");
const prisma_client_1 = require("../../utils/prisma-client");
const gift_card_errors_1 = require("./gift-card.errors");
const gift_card_utils_1 = require("./gift-card.utils");
const productListInclude = {
    category: { select: { id: true, title: true, slug: true } },
    denominations: {
        orderBy: [{ sortOrder: "asc" }, { cardValue: "asc" }],
        include: { _count: { select: { codes: true, orderItems: true } } },
    },
};
const audit = (actorId, action, entityType, entityId, metadata) => prisma_client_1.prismaC.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } });
const productData = (input) => ({
    ...(input.name !== undefined && { title: input.name }),
    ...(input.slug !== undefined && { slug: input.slug }),
    ...(input.brand !== undefined && { brand: input.brand }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.shortDescription !== undefined && { shortDescription: input.shortDescription }),
    ...(input.imageUrl !== undefined && { image: input.imageUrl }),
    ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
    ...(input.bannerImage !== undefined && { bannerImage: input.bannerImage }),
    ...(input.termsAndConditions !== undefined && { termsAndConditions: input.termsAndConditions }),
    ...(input.instructions !== undefined && { instructions: input.instructions }),
    ...(input.currency !== undefined && { cardCurrency: input.currency }),
    ...(input.region !== undefined && { region: input.region }),
    ...(input.deliveryType !== undefined && { deliveryType: input.deliveryType }),
    ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
    ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    ...(input.isActive !== undefined && {
        status: input.isActive ? client_1.ProductStatus.ACTIVE : client_1.ProductStatus.INACTIVE,
    }),
});
const denominationData = (input) => ({
    ...(input.faceValue !== undefined && { cardValue: input.faceValue }),
    ...(input.faceCurrency !== undefined && { cardCurrency: input.faceCurrency }),
    ...(input.sellingPriceBdt !== undefined && { sellingPriceBDT: input.sellingPriceBdt }),
    ...(input.title !== undefined && { title: input.title }),
    ...(input.costPriceBdt !== undefined && { costPriceBDT: input.costPriceBdt }),
    ...(input.isPopular !== undefined && { isPopular: input.isPopular }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
});
const assertProduct = async (id) => {
    const product = await prisma_client_1.prismaC.giftCardProduct.findFirst({ where: { id, deletedAt: null } });
    if (!product)
        throw (0, gift_card_errors_1.giftCardError)(404, "GIFT_CARD_NOT_FOUND", "Gift card not found");
    return product;
};
const assertDenomination = async (id) => {
    const denomination = await prisma_client_1.prismaC.giftCardDenomination.findUnique({
        where: { id },
        include: { giftCardProduct: true },
    });
    if (!denomination || denomination.giftCardProduct.deletedAt) {
        throw (0, gift_card_errors_1.giftCardError)(404, "GIFT_CARD_DENOMINATION_NOT_FOUND", "Gift card denomination not found");
    }
    return denomination;
};
const listProducts = async (query) => {
    const where = {
        deletedAt: null,
        ...(query.status && { status: query.status }),
        ...(query.brand && { brand: { equals: query.brand, mode: "insensitive" } }),
        ...(query.search && {
            OR: ["title", "brand", "slug"].map((field) => ({
                [field]: { contains: query.search, mode: "insensitive" },
            })),
        }),
    };
    const [data, total] = await prisma_client_1.prismaC.$transaction([
        prisma_client_1.prismaC.giftCardProduct.findMany({
            where,
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            include: productListInclude,
        }),
        prisma_client_1.prismaC.giftCardProduct.count({ where }),
    ]);
    return { data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
};
const getProduct = async (id) => {
    await assertProduct(id);
    const product = await prisma_client_1.prismaC.giftCardProduct.findUnique({ where: { id }, include: productListInclude });
    const stock = await prisma_client_1.prismaC.giftCardCode.groupBy({
        by: ["denominationId", "status"],
        where: { denomination: { giftCardProductId: id } },
        _count: { _all: true },
    });
    return {
        ...product,
        denominations: product.denominations.map((denomination) => ({
            ...denomination,
            stock: Object.fromEntries(Object.values(client_1.GiftCardCodeStatus).map((status) => [
                status,
                stock.find((row) => row.denominationId === denomination.id && row.status === status)?._count._all ?? 0,
            ])),
        })),
    };
};
const createProduct = async (actorId, input) => {
    const product = await prisma_client_1.prismaC.giftCardProduct.create({
        data: { ...productData(input), createdById: actorId, updatedById: actorId },
        include: productListInclude,
    });
    await audit(actorId, "GIFT_CARD_CREATED", "GiftCardProduct", product.id);
    return product;
};
const updateProduct = async (actorId, id, input) => {
    await assertProduct(id);
    const product = await prisma_client_1.prismaC.giftCardProduct.update({
        where: { id },
        data: { ...productData(input), updatedById: actorId },
        include: productListInclude,
    });
    await audit(actorId, "GIFT_CARD_UPDATED", "GiftCardProduct", id);
    return product;
};
const archiveProduct = async (actorId, id) => {
    await assertProduct(id);
    const product = await prisma_client_1.prismaC.giftCardProduct.update({
        where: { id },
        data: { status: client_1.ProductStatus.ARCHIVED, deletedAt: new Date(), updatedById: actorId },
    });
    await audit(actorId, "GIFT_CARD_ARCHIVED", "GiftCardProduct", id);
    return product;
};
const createDenomination = async (actorId, productId, input) => {
    await assertProduct(productId);
    const denomination = await prisma_client_1.prismaC.giftCardDenomination.create({
        data: { giftCardProductId: productId, ...denominationData(input) },
    });
    await audit(actorId, "GIFT_CARD_DENOMINATION_CREATED", "GiftCardDenomination", denomination.id);
    return denomination;
};
const listDenominations = async (productId) => {
    await assertProduct(productId);
    const denominations = await prisma_client_1.prismaC.giftCardDenomination.findMany({
        where: { giftCardProductId: productId },
        orderBy: [{ sortOrder: "asc" }, { cardValue: "asc" }],
    });
    const counts = await prisma_client_1.prismaC.giftCardCode.groupBy({
        by: ["denominationId", "status"],
        where: { denominationId: { in: denominations.map((item) => item.id) } },
        _count: { _all: true },
    });
    return denominations.map((denomination) => ({
        ...denomination,
        stock: Object.fromEntries(Object.values(client_1.GiftCardCodeStatus).map((status) => [status, counts.find((row) => row.denominationId === denomination.id && row.status === status)?._count._all ?? 0])),
    }));
};
const updateDenomination = async (actorId, id, input) => {
    await assertDenomination(id);
    const denomination = await prisma_client_1.prismaC.giftCardDenomination.update({
        where: { id },
        data: denominationData(input),
    });
    await audit(actorId, "GIFT_CARD_DENOMINATION_UPDATED", "GiftCardDenomination", id);
    return denomination;
};
const deleteDenomination = async (actorId, id) => {
    await assertDenomination(id);
    const [codeCount, orderCount] = await Promise.all([
        prisma_client_1.prismaC.giftCardCode.count({ where: { denominationId: id } }),
        prisma_client_1.prismaC.orderItem.count({ where: { giftCardDenominationId: id } }),
    ]);
    const result = codeCount || orderCount
        ? await prisma_client_1.prismaC.giftCardDenomination.update({ where: { id }, data: { isActive: false } })
        : await prisma_client_1.prismaC.giftCardDenomination.delete({ where: { id } });
    await audit(actorId, codeCount || orderCount ? "GIFT_CARD_DENOMINATION_DEACTIVATED" : "GIFT_CARD_DENOMINATION_DELETED", "GiftCardDenomination", id);
    return result;
};
const codeData = (input, actorId) => {
    const expiryDate = input.expiryDate ? new Date(input.expiryDate) : null;
    return {
        code: input.code,
        pin: input.pin,
        serialNo: input.serialNumber,
        expiryDate,
        status: expiryDate && expiryDate <= new Date() ? client_1.GiftCardCodeStatus.EXPIRED : client_1.GiftCardCodeStatus.AVAILABLE,
        createdById: actorId,
        updatedById: actorId,
    };
};
const addCode = async (actorId, denominationId, input) => {
    await assertDenomination(denominationId);
    const existing = await prisma_client_1.prismaC.giftCardCode.findUnique({ where: { code: input.code }, select: { id: true } });
    if (existing)
        throw (0, gift_card_errors_1.giftCardError)(409, "GIFT_CARD_CODE_ALREADY_EXISTS", "Gift card code already exists");
    const code = await prisma_client_1.prismaC.giftCardCode.create({ data: { denominationId, ...codeData(input, actorId) } });
    await audit(actorId, "GIFT_CARD_CODE_CREATED", "GiftCardCode", code.id, { denominationId });
    return { ...code, code: (0, gift_card_utils_1.maskGiftCardCode)(code.code), pin: code.pin ? "****" : null };
};
const addCodesBulk = async (actorId, denominationId, inputs) => {
    await assertDenomination(denominationId);
    const normalized = inputs.map((item) => item.code);
    const duplicatesInRequest = normalized.filter((code, index) => normalized.indexOf(code) !== index);
    const existing = await prisma_client_1.prismaC.giftCardCode.findMany({ where: { code: { in: normalized } }, select: { code: true } });
    if (duplicatesInRequest.length || existing.length) {
        const duplicates = [...new Set([...duplicatesInRequest, ...existing.map((item) => item.code)])];
        throw (0, gift_card_errors_1.giftCardError)(409, "GIFT_CARD_CODE_ALREADY_EXISTS", "One or more gift card codes already exist", { duplicates: duplicates.map(gift_card_utils_1.maskGiftCardCode) });
    }
    const created = await prisma_client_1.prismaC.giftCardCode.createMany({
        data: inputs.map((input) => ({ denominationId, ...codeData(input, actorId) })),
    });
    await audit(actorId, "GIFT_CARD_CODES_BULK_CREATED", "GiftCardDenomination", denominationId, { count: created.count });
    return { inserted: created.count };
};
const listCodes = async (denominationId, query) => {
    await assertDenomination(denominationId);
    const where = {
        denominationId,
        ...(query.status && { status: query.status }),
        ...((query.expiryBefore || query.expiryAfter) && {
            expiryDate: {
                ...(query.expiryBefore && { lte: new Date(query.expiryBefore) }),
                ...(query.expiryAfter && { gte: new Date(query.expiryAfter) }),
            },
        }),
    };
    const [codes, total] = await prisma_client_1.prismaC.$transaction([
        prisma_client_1.prismaC.giftCardCode.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: "desc" } }),
        prisma_client_1.prismaC.giftCardCode.count({ where }),
    ]);
    return {
        data: codes.map((item) => ({ ...item, code: (0, gift_card_utils_1.maskGiftCardCode)(item.code), pin: item.pin ? "****" : null })),
        meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
};
const getCode = async (id) => {
    const code = await prisma_client_1.prismaC.giftCardCode.findUnique({ where: { id }, include: { denomination: { include: { giftCardProduct: true } } } });
    if (!code)
        throw (0, gift_card_errors_1.giftCardError)(404, "GIFT_CARD_CODE_NOT_FOUND", "Gift card code not found");
    return code;
};
const allowedTransitions = {
    AVAILABLE: [client_1.GiftCardCodeStatus.DISABLED, client_1.GiftCardCodeStatus.EXPIRED],
    RESERVED: [client_1.GiftCardCodeStatus.AVAILABLE],
    SOLD: [],
    DISABLED: [client_1.GiftCardCodeStatus.AVAILABLE, client_1.GiftCardCodeStatus.EXPIRED],
    EXPIRED: [client_1.GiftCardCodeStatus.DISABLED],
};
const updateCode = async (actorId, id, input) => {
    const existing = await getCode(id);
    if (existing.status === client_1.GiftCardCodeStatus.SOLD) {
        throw (0, gift_card_errors_1.giftCardError)(409, "GIFT_CARD_CODE_ALREADY_SOLD", "Sold gift card codes are immutable");
    }
    if (input.status && input.status !== existing.status && !allowedTransitions[existing.status].includes(input.status)) {
        throw (0, gift_card_errors_1.giftCardError)(409, "INVALID_GIFT_CARD_CODE_STATE", `Cannot change code from ${existing.status} to ${input.status}`);
    }
    if (input.code && input.code !== existing.code) {
        const duplicate = await prisma_client_1.prismaC.giftCardCode.findUnique({ where: { code: input.code }, select: { id: true } });
        if (duplicate)
            throw (0, gift_card_errors_1.giftCardError)(409, "GIFT_CARD_CODE_ALREADY_EXISTS", "Gift card code already exists");
    }
    const expiryDate = input.expiryDate === null ? null : input.expiryDate ? new Date(input.expiryDate) : undefined;
    const nextStatus = expiryDate && expiryDate <= new Date()
        ? client_1.GiftCardCodeStatus.EXPIRED
        : input.status;
    if (nextStatus === client_1.GiftCardCodeStatus.AVAILABLE && (expiryDate ?? existing.expiryDate) && (expiryDate ?? existing.expiryDate) <= new Date()) {
        throw (0, gift_card_errors_1.giftCardError)(409, "INVALID_GIFT_CARD_CODE_STATE", "An expired code cannot be made available");
    }
    const code = await prisma_client_1.prismaC.giftCardCode.update({
        where: { id },
        data: {
            ...(input.code !== undefined && { code: input.code }),
            ...(input.pin !== undefined && { pin: input.pin }),
            ...(input.serialNumber !== undefined && { serialNo: input.serialNumber }),
            ...(expiryDate !== undefined && { expiryDate }),
            ...(nextStatus !== undefined && { status: nextStatus, reservedAt: nextStatus === client_1.GiftCardCodeStatus.RESERVED ? new Date() : null }),
            updatedById: actorId,
        },
    });
    await audit(actorId, "GIFT_CARD_CODE_UPDATED", "GiftCardCode", id, { previousStatus: existing.status, status: code.status });
    return { ...code, code: (0, gift_card_utils_1.maskGiftCardCode)(code.code), pin: code.pin ? "****" : null };
};
const deleteCode = async (actorId, id) => {
    const code = await getCode(id);
    if (code.status === client_1.GiftCardCodeStatus.SOLD || code.orderItemId) {
        throw (0, gift_card_errors_1.giftCardError)(409, "GIFT_CARD_CODE_ALREADY_SOLD", "A sold or allocated gift card code cannot be deleted");
    }
    if (code.status === client_1.GiftCardCodeStatus.RESERVED) {
        throw (0, gift_card_errors_1.giftCardError)(409, "INVALID_GIFT_CARD_CODE_STATE", "A reserved gift card code cannot be deleted");
    }
    await prisma_client_1.prismaC.giftCardCode.delete({ where: { id } });
    await audit(actorId, "GIFT_CARD_CODE_DELETED", "GiftCardCode", id);
    return { id, deleted: true };
};
const inventorySummary = async () => {
    const [totalProducts, grouped, denominations, available] = await Promise.all([
        prisma_client_1.prismaC.giftCardProduct.count({ where: { deletedAt: null } }),
        prisma_client_1.prismaC.giftCardCode.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma_client_1.prismaC.giftCardDenomination.findMany({
            where: { isActive: true, giftCardProduct: { status: client_1.ProductStatus.ACTIVE, deletedAt: null } },
            include: { giftCardProduct: { select: { title: true } } },
        }),
        prisma_client_1.prismaC.giftCardCode.groupBy({
            by: ["denominationId"],
            where: { status: client_1.GiftCardCodeStatus.AVAILABLE, OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }] },
            _count: { _all: true },
        }),
    ]);
    const counts = Object.fromEntries(Object.values(client_1.GiftCardCodeStatus).map((status) => [status, grouped.find((row) => row.status === status)?._count._all ?? 0]));
    return {
        totalProducts,
        totalCodes: Object.values(counts).reduce((sum, value) => sum + value, 0),
        availableCodes: available.reduce((sum, row) => sum + row._count._all, 0),
        reservedCodes: counts.RESERVED,
        soldCodes: counts.SOLD,
        disabledCodes: counts.DISABLED,
        expiredCodes: counts.EXPIRED,
        lowStockDenominations: denominations.map((denomination) => ({
            denominationId: denomination.id,
            giftCard: denomination.giftCardProduct.title,
            denomination: `${(0, gift_card_utils_1.moneyString)(denomination.cardValue)} ${denomination.cardCurrency}`,
            available: available.find((row) => row.denominationId === denomination.id)?._count._all ?? 0,
        })).filter((item) => item.available <= 5).sort((a, b) => a.available - b.available),
    };
};
exports.giftCardAdminService = {
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    archiveProduct,
    createDenomination,
    listDenominations,
    updateDenomination,
    deleteDenomination,
    addCode,
    addCodesBulk,
    listCodes,
    getCode,
    updateCode,
    deleteCode,
    inventorySummary,
};
