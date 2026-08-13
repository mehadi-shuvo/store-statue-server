import { ProductStatus } from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";

type Payload = Record<string, any>;
type Query = Record<string, any>;

const include = {
  category: { select: { id: true, title: true, slug: true } },
  packages: { orderBy: { sortOrder: "asc" as const } },
  inputFields: { orderBy: { sortOrder: "asc" as const } },
};

const positiveNumber = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new ApiAppError(400, `${field} must be greater than 0`);
  }
  return number;
};

const nonNegativeInteger = (value: unknown, field: string): number => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new ApiAppError(400, `${field} must be a non-negative integer`);
  }
  return number;
};

const optionalNonNegativeInteger = (
  value: unknown,
  field: string,
): number | null | undefined => {
  if (value === undefined || value === null) return value;
  return nonNegativeInteger(value, field);
};

const packagesFrom = (payload: Payload) => {
  const values = payload.packages ?? payload.topUpAmounts;
  if (!Array.isArray(values) || values.length === 0) {
    throw new ApiAppError(400, "Top-up packages are required");
  }
  return values.map((item: any, index: number) => {
    const sellingPriceBDT = item.sellingPriceBDT ?? item.price ?? item.realCurrency;
    const gameCurrencyAmount = item.gameCurrencyAmount ?? item.gameCurrency;
    if (sellingPriceBDT == null || gameCurrencyAmount == null) {
      throw new ApiAppError(
        400,
        `Package at index ${index} requires sellingPriceBDT and gameCurrencyAmount`,
      );
    }
    const normalizedCurrencyAmount = positiveNumber(
      gameCurrencyAmount,
      `gameCurrencyAmount at index ${index}`,
    );
    if (!Number.isInteger(normalizedCurrencyAmount)) {
      throw new ApiAppError(400, `gameCurrencyAmount at index ${index} must be an integer`);
    }
    return {
      title: item.title,
      sellingPriceBDT: positiveNumber(sellingPriceBDT, `sellingPriceBDT at index ${index}`),
      gameCurrencyAmount: normalizedCurrencyAmount,
      bonusCurrencyAmount: nonNegativeInteger(
        item.bonusCurrencyAmount ?? 0,
        `bonusCurrencyAmount at index ${index}`,
      ),
      costPriceBDT: item.costPriceBDT,
      discountAmountBDT: item.discountAmountBDT,
      discountPercent: item.discountPercent,
      discountLabel: item.discountLabel,
      isPopular: item.isPopular ?? item.popular ?? false,
      isActive: item.isActive ?? true,
      sortOrder: item.sortOrder ?? index,
      stockQuantity: optionalNonNegativeInteger(
        item.stockQuantity,
        `stockQuantity at index ${index}`,
      ),
    };
  });
};

const inputFieldsFrom = (values: any[] = []) =>
  values.map((item, index) => ({
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

const productData = (p: Payload, userId?: string) => ({
  ...(p.name !== undefined && { name: p.name }),
  ...(p.title !== undefined && { title: p.title }),
  ...(p.slug !== undefined && { slug: p.slug }),
  ...(p.subHeading !== undefined && { subHeading: p.subHeading }),
  ...(p.description !== undefined && { description: p.description }),
  ...(p.logo !== undefined && { logo: p.logo }),
  ...(p.image !== undefined && { logo: p.image }),
  ...(p.bannerImage !== undefined && { bannerImage: p.bannerImage }),
  ...(p.banner !== undefined && { bannerImage: p.banner }),
  ...(p.gameCurrencyName !== undefined && { gameCurrencyName: p.gameCurrencyName }),
  ...(p.fulfillmentType !== undefined && { fulfillmentType: p.fulfillmentType }),
  ...(p.instructions !== undefined && { instructions: p.instructions }),
  ...(p.estimatedDelivery !== undefined && { estimatedDelivery: p.estimatedDelivery }),
  ...(p.termsAndConditions !== undefined && { termsAndConditions: p.termsAndConditions }),
  ...(p.status !== undefined && { status: p.status }),
  ...(p.isFeatured !== undefined && { isFeatured: p.isFeatured }),
  ...(p.sortOrder !== undefined && { sortOrder: p.sortOrder }),
  ...(p.categoryId !== undefined && { categoryId: p.categoryId }),
  ...(userId && { updatedById: userId }),
});

const getTopUps = async (query: Query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
  if (query.status && !Object.values(ProductStatus).includes(query.status as ProductStatus)) {
    throw new ApiAppError(400, "Invalid product status");
  }
  const where: any = {
    deletedAt: null,
    status: query.status ?? "ACTIVE",
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.isFeatured !== undefined && { isFeatured: query.isFeatured === "true" }),
    ...(query.search && {
      OR: ["name", "title", "slug"].map((field) => ({
        [field]: { contains: query.search, mode: "insensitive" },
      })),
    }),
  };
  const [data, total] = await prismaC.$transaction([
    prismaC.gameTopUpProduct.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include,
    }),
    prismaC.gameTopUpProduct.count({ where }),
  ]);
  return { meta: { total, page, limit, totalPages: Math.ceil(total / limit) }, data };
};

const getTopUpById = async (id: string, includeInactive = false) => {
  const result = await prismaC.gameTopUpProduct.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
      deletedAt: null,
      ...(includeInactive ? {} : { status: ProductStatus.ACTIVE }),
    },
    include,
  });
  if (!result) throw new ApiAppError(404, "Top-up product not found");
  return result;
};

const createTopUp = async (payload: Payload, userId?: string) => {
  const packages = packagesFrom(payload);
  const name = payload.name ?? payload.title;
  const title = payload.title ?? payload.name;
  const logo = payload.logo ?? payload.image;
  if (!name || !title || !payload.slug || !logo || !payload.gameCurrencyName) {
    throw new ApiAppError(400, "name, title, slug, logo and gameCurrencyName are required");
  }
  if (!payload.fulfillmentType) {
    throw new ApiAppError(400, "fulfillmentType is required");
  }
  return prismaC.gameTopUpProduct.create({
    data: {
      ...productData(payload),
      name,
      title,
      slug: payload.slug,
      logo,
      gameCurrencyName: payload.gameCurrencyName,
      fulfillmentType: payload.fulfillmentType,
      ...(userId && { createdById: userId, updatedById: userId }),
      packages: { create: packages },
      inputFields: { create: inputFieldsFrom(payload.inputFields) },
    },
    include,
  });
};

const updateTopUp = async (id: string, payload: Payload, userId?: string) => {
  const existing = await getTopUpById(id, true);
  const packages =
    payload.packages || payload.topUpAmounts ? packagesFrom(payload) : undefined;
  const inputFields = payload.inputFields
    ? inputFieldsFrom(payload.inputFields)
    : undefined;
  return prismaC.gameTopUpProduct.update({
    where: { id: existing.id },
    data: {
      ...productData(payload, userId),
      ...(packages && { packages: { deleteMany: {}, create: packages } }),
      ...(inputFields && { inputFields: { deleteMany: {}, create: inputFields } }),
    },
    include,
  });
};

const deleteTopUp = async (id: string) => {
  const existing = await getTopUpById(id, true);
  return prismaC.gameTopUpProduct.update({
    where: { id: existing.id },
    data: { status: "ARCHIVED", deletedAt: new Date() },
  });
};

export const gameTopUpServices = {
  getTopUps,
  getTopUpById,
  createTopUp,
  updateTopUp,
  deleteTopUp,
};
