import {
  GiftCardCodeStatus,
  ProductStatus,
  type Prisma,
} from "../../generated/prisma/client";
import { prismaC } from "../../utils/prisma-client";
import { giftCardError } from "./gift-card.errors";
import {
  decryptGiftCardSecret,
  encryptGiftCardSecret,
  giftCardSecretHash,
} from "./gift-card-crypto";
import { maskGiftCardCode, moneyString } from "./gift-card.utils";
import type {
  CreateDenominationInput,
  CreateGiftCardInput,
  InventoryCodeInput,
  UpdateDenominationInput,
  UpdateGiftCardInput,
  UpdateInventoryCodeInput,
} from "./gift-card.validation";

type PageQuery = { page: number; limit: number };
type AdminProductQuery = PageQuery & { search?: string; status?: ProductStatus; brand?: string };
type InventoryQuery = PageQuery & {
  status?: GiftCardCodeStatus;
  expiryBefore?: string;
  expiryAfter?: string;
};

const productListInclude = {
  category: { select: { id: true, title: true, slug: true } },
  denominations: {
    orderBy: [{ sortOrder: "asc" as const }, { cardValue: "asc" as const }],
    include: { _count: { select: { codes: true, orderItems: true } } },
  },
};

const audit = (actorId: string, action: string, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) =>
  prismaC.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } });

const productData = (input: CreateGiftCardInput | UpdateGiftCardInput) => ({
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
    status: input.isActive ? ProductStatus.ACTIVE : ProductStatus.INACTIVE,
  }),
});

const denominationData = (input: CreateDenominationInput | UpdateDenominationInput) => ({
  ...(input.faceValue !== undefined && { cardValue: input.faceValue }),
  ...(input.faceCurrency !== undefined && { cardCurrency: input.faceCurrency }),
  ...(input.sellingPriceBdt !== undefined && { sellingPriceBDT: input.sellingPriceBdt }),
  ...(input.title !== undefined && { title: input.title }),
  ...(input.costPriceBdt !== undefined && { costPriceBDT: input.costPriceBdt }),
  ...(input.isPopular !== undefined && { isPopular: input.isPopular }),
  ...(input.isActive !== undefined && { isActive: input.isActive }),
  ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
});

const assertProduct = async (id: string) => {
  const product = await prismaC.giftCardProduct.findFirst({ where: { id, deletedAt: null } });
  if (!product) throw giftCardError(404, "GIFT_CARD_NOT_FOUND", "Gift card not found");
  return product;
};

const assertDenomination = async (id: string) => {
  const denomination = await prismaC.giftCardDenomination.findUnique({
    where: { id },
    include: { giftCardProduct: true },
  });
  if (!denomination || denomination.giftCardProduct.deletedAt) {
    throw giftCardError(404, "GIFT_CARD_DENOMINATION_NOT_FOUND", "Gift card denomination not found");
  }
  return denomination;
};

const listProducts = async (query: AdminProductQuery) => {
  const where: Prisma.GiftCardProductWhereInput = {
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.brand && { brand: { equals: query.brand, mode: "insensitive" } }),
    ...(query.search && {
      OR: ["title", "brand", "slug"].map((field) => ({
        [field]: { contains: query.search, mode: "insensitive" },
      })),
    }),
  };
  const [data, total] = await prismaC.$transaction([
    prismaC.giftCardProduct.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: productListInclude,
    }),
    prismaC.giftCardProduct.count({ where }),
  ]);
  return { data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
};

const getProduct = async (id: string) => {
  await assertProduct(id);
  const product = await prismaC.giftCardProduct.findUnique({ where: { id }, include: productListInclude });
  const stock = await prismaC.giftCardCode.groupBy({
    by: ["denominationId", "status"],
    where: { denomination: { giftCardProductId: id } },
    _count: { _all: true },
  });
  return {
    ...product,
    denominations: product!.denominations.map((denomination) => ({
      ...denomination,
      stock: Object.fromEntries(Object.values(GiftCardCodeStatus).map((status) => [
        status,
        stock.find((row) => row.denominationId === denomination.id && row.status === status)?._count._all ?? 0,
      ])),
    })),
  };
};

const createProduct = async (actorId: string, input: CreateGiftCardInput) => {
  const product = await prismaC.giftCardProduct.create({
    data: { ...productData(input), createdById: actorId, updatedById: actorId } as Prisma.GiftCardProductUncheckedCreateInput,
    include: productListInclude,
  });
  await audit(actorId, "GIFT_CARD_CREATED", "GiftCardProduct", product.id);
  return product;
};

const updateProduct = async (actorId: string, id: string, input: UpdateGiftCardInput) => {
  await assertProduct(id);
  const product = await prismaC.giftCardProduct.update({
    where: { id },
    data: { ...productData(input), updatedById: actorId } as Prisma.GiftCardProductUncheckedUpdateInput,
    include: productListInclude,
  });
  await audit(actorId, "GIFT_CARD_UPDATED", "GiftCardProduct", id);
  return product;
};

const archiveProduct = async (actorId: string, id: string) => {
  await assertProduct(id);
  const product = await prismaC.giftCardProduct.update({
    where: { id },
    data: { status: ProductStatus.ARCHIVED, deletedAt: new Date(), updatedById: actorId },
  });
  await audit(actorId, "GIFT_CARD_ARCHIVED", "GiftCardProduct", id);
  return product;
};

const createDenomination = async (actorId: string, productId: string, input: CreateDenominationInput) => {
  await assertProduct(productId);
  const denomination = await prismaC.giftCardDenomination.create({
    data: { giftCardProductId: productId, ...denominationData(input) } as Prisma.GiftCardDenominationUncheckedCreateInput,
  });
  await audit(actorId, "GIFT_CARD_DENOMINATION_CREATED", "GiftCardDenomination", denomination.id);
  return denomination;
};

const listDenominations = async (productId: string) => {
  await assertProduct(productId);
  const denominations = await prismaC.giftCardDenomination.findMany({
    where: { giftCardProductId: productId },
    orderBy: [{ sortOrder: "asc" }, { cardValue: "asc" }],
  });
  const counts = await prismaC.giftCardCode.groupBy({
    by: ["denominationId", "status"],
    where: { denominationId: { in: denominations.map((item) => item.id) } },
    _count: { _all: true },
  });
  return denominations.map((denomination) => ({
    ...denomination,
    stock: Object.fromEntries(Object.values(GiftCardCodeStatus).map((status) => [status, counts.find((row) => row.denominationId === denomination.id && row.status === status)?._count._all ?? 0])),
  }));
};

const updateDenomination = async (actorId: string, id: string, input: UpdateDenominationInput) => {
  await assertDenomination(id);
  const denomination = await prismaC.giftCardDenomination.update({
    where: { id },
    data: denominationData(input) as Prisma.GiftCardDenominationUncheckedUpdateInput,
  });
  await audit(actorId, "GIFT_CARD_DENOMINATION_UPDATED", "GiftCardDenomination", id);
  return denomination;
};

const deleteDenomination = async (actorId: string, id: string) => {
  await assertDenomination(id);
  const [codeCount, orderCount] = await Promise.all([
    prismaC.giftCardCode.count({ where: { denominationId: id } }),
    prismaC.orderItem.count({ where: { giftCardDenominationId: id } }),
  ]);
  const result = codeCount || orderCount
    ? await prismaC.giftCardDenomination.update({ where: { id }, data: { isActive: false } })
    : await prismaC.giftCardDenomination.delete({ where: { id } });
  await audit(actorId, codeCount || orderCount ? "GIFT_CARD_DENOMINATION_DEACTIVATED" : "GIFT_CARD_DENOMINATION_DELETED", "GiftCardDenomination", id);
  return result;
};

const codeData = (input: InventoryCodeInput, actorId: string) => {
  const expiryDate = input.expiryDate ? new Date(input.expiryDate) : null;
  return {
    code: encryptGiftCardSecret(input.code)!,
    codeHash: giftCardSecretHash(input.code),
    pin: encryptGiftCardSecret(input.pin),
    serialNo: input.serialNumber,
    expiryDate,
    status: expiryDate && expiryDate <= new Date() ? GiftCardCodeStatus.EXPIRED : GiftCardCodeStatus.AVAILABLE,
    createdById: actorId,
    updatedById: actorId,
  };
};

const addCode = async (actorId: string, denominationId: string, input: InventoryCodeInput) => {
  await assertDenomination(denominationId);
  const existing = await prismaC.giftCardCode.findFirst({
    where: { OR: [{ codeHash: giftCardSecretHash(input.code) }, { code: input.code }] },
    select: { id: true },
  });
  if (existing) throw giftCardError(409, "GIFT_CARD_CODE_ALREADY_EXISTS", "Gift card code already exists");
  const code = await prismaC.giftCardCode.create({ data: { denominationId, ...codeData(input, actorId) } });
  await audit(actorId, "GIFT_CARD_CODE_CREATED", "GiftCardCode", code.id, { denominationId });
  return { ...code, code: maskGiftCardCode(input.code), pin: input.pin ? "****" : null };
};

const addCodesBulk = async (actorId: string, denominationId: string, inputs: InventoryCodeInput[]) => {
  await assertDenomination(denominationId);
  const normalized = inputs.map((item) => item.code.trim());
  const duplicatesInRequest = normalized.filter((code, index) => normalized.indexOf(code) !== index);
  const hashes = normalized.map(giftCardSecretHash);
  const existing = await prismaC.giftCardCode.findMany({
    where: { OR: [{ codeHash: { in: hashes } }, { code: { in: normalized } }] },
    select: { codeHash: true, code: true },
  });
  if (duplicatesInRequest.length || existing.length) {
    const existingHashes = new Set(existing.map((item) => item.codeHash));
    const legacyCodes = new Set(existing.filter((item) => !item.codeHash).map((item) => item.code));
    const duplicates = [...new Set([...duplicatesInRequest, ...normalized.filter((code) => existingHashes.has(giftCardSecretHash(code)) || legacyCodes.has(code))])];
    throw giftCardError(409, "GIFT_CARD_CODE_ALREADY_EXISTS", "One or more gift card codes already exist", { duplicates: duplicates.map(maskGiftCardCode) });
  }
  const created = await prismaC.giftCardCode.createMany({
    data: inputs.map((input) => ({ denominationId, ...codeData(input, actorId) })),
  });
  await audit(actorId, "GIFT_CARD_CODES_BULK_CREATED", "GiftCardDenomination", denominationId, { count: created.count });
  return { inserted: created.count };
};

const listCodes = async (denominationId: string, query: InventoryQuery) => {
  await assertDenomination(denominationId);
  const where: Prisma.GiftCardCodeWhereInput = {
    denominationId,
    ...(query.status && { status: query.status }),
    ...((query.expiryBefore || query.expiryAfter) && {
      expiryDate: {
        ...(query.expiryBefore && { lte: new Date(query.expiryBefore) }),
        ...(query.expiryAfter && { gte: new Date(query.expiryAfter) }),
      },
    }),
  };
  const [codes, total] = await prismaC.$transaction([
    prismaC.giftCardCode.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: "desc" } }),
    prismaC.giftCardCode.count({ where }),
  ]);
  return {
    data: codes.map((item) => ({ ...item, code: maskGiftCardCode(decryptGiftCardSecret(item.code)!), pin: item.pin ? "****" : null })),
    meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
  };
};

const getCode = async (id: string) => {
  const code = await prismaC.giftCardCode.findUnique({ where: { id }, include: { denomination: { include: { giftCardProduct: true } } } });
  if (!code) throw giftCardError(404, "GIFT_CARD_CODE_NOT_FOUND", "Gift card code not found");
  return {
    ...code,
    code: decryptGiftCardSecret(code.code)!,
    pin: decryptGiftCardSecret(code.pin),
  };
};

const allowedTransitions: Record<GiftCardCodeStatus, GiftCardCodeStatus[]> = {
  AVAILABLE: [GiftCardCodeStatus.DISABLED, GiftCardCodeStatus.EXPIRED],
  RESERVED: [GiftCardCodeStatus.AVAILABLE],
  SOLD: [],
  DISABLED: [GiftCardCodeStatus.AVAILABLE, GiftCardCodeStatus.EXPIRED],
  EXPIRED: [GiftCardCodeStatus.DISABLED],
};

const updateCode = async (actorId: string, id: string, input: UpdateInventoryCodeInput) => {
  const existing = await getCode(id);
  if (existing.status === GiftCardCodeStatus.SOLD) {
    throw giftCardError(409, "GIFT_CARD_CODE_ALREADY_SOLD", "Sold gift card codes are immutable");
  }
  if (input.status && input.status !== existing.status && !allowedTransitions[existing.status].includes(input.status)) {
    throw giftCardError(409, "INVALID_GIFT_CARD_CODE_STATE", `Cannot change code from ${existing.status} to ${input.status}`);
  }
  if (input.code && input.code !== existing.code) {
    const duplicate = await prismaC.giftCardCode.findFirst({ where: { OR: [{ codeHash: giftCardSecretHash(input.code) }, { code: input.code }] }, select: { id: true } });
    if (duplicate) throw giftCardError(409, "GIFT_CARD_CODE_ALREADY_EXISTS", "Gift card code already exists");
  }
  const expiryDate = input.expiryDate === null ? null : input.expiryDate ? new Date(input.expiryDate) : undefined;
  const nextStatus =
    expiryDate && expiryDate <= new Date()
      ? GiftCardCodeStatus.EXPIRED
      : input.status;
  if (nextStatus === GiftCardCodeStatus.AVAILABLE && (expiryDate ?? existing.expiryDate) && (expiryDate ?? existing.expiryDate)! <= new Date()) {
    throw giftCardError(409, "INVALID_GIFT_CARD_CODE_STATE", "An expired code cannot be made available");
  }
  const code = await prismaC.giftCardCode.update({
    where: { id },
    data: {
      ...(input.code !== undefined && { code: encryptGiftCardSecret(input.code)!, codeHash: giftCardSecretHash(input.code) }),
      ...(input.pin !== undefined && { pin: encryptGiftCardSecret(input.pin) }),
      ...(input.serialNumber !== undefined && { serialNo: input.serialNumber }),
      ...(expiryDate !== undefined && { expiryDate }),
      ...(nextStatus !== undefined && { status: nextStatus, reservedAt: nextStatus === GiftCardCodeStatus.RESERVED ? new Date() : null }),
      updatedById: actorId,
    },
  });
  await audit(actorId, "GIFT_CARD_CODE_UPDATED", "GiftCardCode", id, { previousStatus: existing.status, status: code.status });
  return { ...code, code: maskGiftCardCode(input.code ?? existing.code), pin: code.pin ? "****" : null };
};

const deleteCode = async (actorId: string, id: string) => {
  const code = await getCode(id);
  if (code.status === GiftCardCodeStatus.SOLD || code.orderItemId) {
    throw giftCardError(409, "GIFT_CARD_CODE_ALREADY_SOLD", "A sold or allocated gift card code cannot be deleted");
  }
  if (code.status === GiftCardCodeStatus.RESERVED) {
    throw giftCardError(409, "INVALID_GIFT_CARD_CODE_STATE", "A reserved gift card code cannot be deleted");
  }
  await prismaC.giftCardCode.delete({ where: { id } });
  await audit(actorId, "GIFT_CARD_CODE_DELETED", "GiftCardCode", id);
  return { id, deleted: true };
};

const inventorySummary = async () => {
  const [totalProducts, grouped, denominations, available] = await Promise.all([
    prismaC.giftCardProduct.count({ where: { deletedAt: null } }),
    prismaC.giftCardCode.groupBy({ by: ["status"], _count: { _all: true } }),
    prismaC.giftCardDenomination.findMany({
      where: { isActive: true, giftCardProduct: { status: ProductStatus.ACTIVE, deletedAt: null } },
      include: { giftCardProduct: { select: { title: true } } },
    }),
    prismaC.giftCardCode.groupBy({
      by: ["denominationId"],
      where: { status: GiftCardCodeStatus.AVAILABLE, OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }] },
      _count: { _all: true },
    }),
  ]);
  const counts = Object.fromEntries(Object.values(GiftCardCodeStatus).map((status) => [status, grouped.find((row) => row.status === status)?._count._all ?? 0]));
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
      denomination: `${moneyString(denomination.cardValue)} ${denomination.cardCurrency}`,
      available: available.find((row) => row.denominationId === denomination.id)?._count._all ?? 0,
    })).filter((item) => item.available <= 5).sort((a, b) => a.available - b.available),
  };
};

export const giftCardAdminService = {
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
