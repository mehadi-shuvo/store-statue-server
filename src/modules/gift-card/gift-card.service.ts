import { ProductStatus } from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";

type Query = {
  page?: string;
  limit?: string;
  search?: string;
  categoryId?: string;
  status?: string;
  isFeatured?: string;
};

type DenominationPayload = {
  title?: string;
  sellingPriceBDT?: number;
  bdtPrice?: number;
  BDT?: number;
  cardValue?: number;
  cardUSD?: number;
  cardCurrency?: string;
  costPriceBDT?: number;
  discountAmountBDT?: number;
  discountPercent?: number;
  discountLabel?: string;
  isPopular?: boolean;
  popular?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  stockQuantity?: number | null;
};

type GiftCardPayload = Record<string, any> & {
  denominations?: DenominationPayload[];
  amounts?: DenominationPayload[];
};

const include = {
  category: { select: { id: true, title: true, slug: true } },
  denominations: { orderBy: { sortOrder: "asc" as const } },
};

const positiveNumber = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new ApiAppError(400, `${field} must be greater than 0`);
  }
  return number;
};

const stockValue = (value: unknown, field: string) => {
  if (value === undefined || value === null) return value as undefined | null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new ApiAppError(400, `${field} must be a non-negative integer or null`);
  }
  return number;
};

const normalizeDenominations = (payload: GiftCardPayload) => {
  const values = payload.denominations ?? payload.amounts;
  if (!Array.isArray(values) || values.length === 0) {
    throw new ApiAppError(400, "Gift card denominations are required");
  }

  return values.map((item, index) => {
    const sellingPriceBDT = item.sellingPriceBDT ?? item.bdtPrice ?? item.BDT;
    const cardValue = item.cardValue ?? item.cardUSD;
    if (sellingPriceBDT == null || cardValue == null) {
      throw new ApiAppError(
        400,
        `Denomination at index ${index} requires sellingPriceBDT and cardValue`,
      );
    }
    const discountPercent = item.discountPercent;
    if (
      discountPercent !== undefined &&
      (!Number.isFinite(Number(discountPercent)) ||
        Number(discountPercent) < 0 ||
        Number(discountPercent) > 100)
    ) {
      throw new ApiAppError(400, `discountPercent at index ${index} must be 0-100`);
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

const productData = (payload: GiftCardPayload, userId?: string) => ({
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

const getGiftCards = async (query: Query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
  if (query.status && !Object.values(ProductStatus).includes(query.status as ProductStatus)) {
    throw new ApiAppError(400, "Invalid product status");
  }
  const where: any = {
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
  const [data, total] = await prismaC.$transaction([
    prismaC.giftCardProduct.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include,
    }),
    prismaC.giftCardProduct.count({ where }),
  ]);
  return { meta: { total, page, limit, totalPages: Math.ceil(total / limit) }, data };
};

const getGiftCardById = async (id: string, includeInactive = false) => {
  const result = await prismaC.giftCardProduct.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
      deletedAt: null,
      ...(includeInactive ? {} : { status: ProductStatus.ACTIVE }),
    },
    include,
  });
  if (!result) throw new ApiAppError(404, "Gift card not found");
  return result;
};

const createGiftCard = async (payload: GiftCardPayload, userId?: string) => {
  const denominations = normalizeDenominations(payload);
  if (!payload.brand || !payload.title || !payload.slug) {
    throw new ApiAppError(400, "brand, title and slug are required");
  }
  const image = payload.image ?? payload.thumbnail;
  if (!image) throw new ApiAppError(400, "image is required");

  return prismaC.giftCardProduct.create({
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

const updateGiftCard = async (id: string, payload: GiftCardPayload, userId?: string) => {
  const existing = await getGiftCardById(id, true);
  const denominations =
    payload.denominations || payload.amounts ? normalizeDenominations(payload) : undefined;
  return prismaC.giftCardProduct.update({
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

const deleteGiftCard = async (id: string) => {
  const existing = await getGiftCardById(id, true);
  return prismaC.giftCardProduct.update({
    where: { id: existing.id },
    data: { status: "ARCHIVED", deletedAt: new Date() },
  });
};

export const giftCardServices = {
  getGiftCards,
  getGiftCardById,
  createGiftCard,
  updateGiftCard,
  deleteGiftCard,
};
