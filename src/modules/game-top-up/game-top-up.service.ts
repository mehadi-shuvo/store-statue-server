import { GameTopUpFulfillmentType, ProductStatus, type Prisma } from "../../generated/prisma/client";
import { prismaC } from "../../utils/prisma-client";
import { gameTopUpError } from "./game-top-up.errors";
import {
  createAccountFieldSchema, createGameSchema, createPackageSchema, updateGameSchema,
} from "./game-top-up.validation";
import type {
  CreateAccountFieldInput, CreateGameInput, CreatePackageInput,
  UpdateAccountFieldInput, UpdateGameInput, UpdatePackageInput,
} from "./game-top-up.validation";

type PageQuery = { page?: number; limit?: number; search?: string; categoryId?: string; status?: ProductStatus };

const publicInclude = {
  category: { select: { id: true, title: true, slug: true } },
  packages: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" as const }, { gameCurrencyAmount: "asc" as const }],
    select: { id: true, title: true, sellingPriceBDT: true, gameCurrencyAmount: true, bonusCurrencyAmount: true, isPopular: true, sortOrder: true },
  },
  inputFields: {
    where: { isActive: true },
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, name: true, label: true, type: true, placeholder: true, helpText: true, isRequired: true, options: true, validationRules: true, sortOrder: true },
  },
};

const adminInclude = {
  category: { select: { id: true, title: true, slug: true } },
  packages: { orderBy: [{ sortOrder: "asc" as const }, { gameCurrencyAmount: "asc" as const }] },
  inputFields: { orderBy: { sortOrder: "asc" as const } },
};

const audit = (actorId: string, action: string, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) =>
  prismaC.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } });

const assertGame = async (id: string) => {
  const game = await prismaC.gameTopUpProduct.findFirst({ where: { id, deletedAt: null } });
  if (!game) throw gameTopUpError(404, "GAME_NOT_FOUND", "Game not found");
  return game;
};

const assertPackage = async (id: string) => {
  const item = await prismaC.gameTopUpPackage.findUnique({ where: { id }, include: { gameTopUpProduct: true } });
  if (!item || item.gameTopUpProduct.deletedAt) throw gameTopUpError(404, "PACKAGE_NOT_FOUND", "Top-up package not found");
  return item;
};

const assertField = async (id: string) => {
  const field = await prismaC.gameTopUpInputField.findUnique({ where: { id }, include: { gameTopUpProduct: true } });
  if (!field || field.gameTopUpProduct.deletedAt) throw gameTopUpError(404, "ACCOUNT_FIELD_NOT_FOUND", "Account field not found");
  return field;
};

const gameData = (input: CreateGameInput | UpdateGameInput) => ({
  ...(input.name !== undefined && { name: input.name }),
  ...(input.title !== undefined && { title: input.title }),
  ...(input.slug !== undefined && { slug: input.slug }),
  ...(input.description !== undefined && { description: input.description }),
  ...(input.subHeading !== undefined && { subHeading: input.subHeading }),
  ...(input.logoUrl !== undefined && { logo: input.logoUrl }),
  ...(input.bannerUrl !== undefined && { bannerImage: input.bannerUrl }),
  ...(input.gameCurrencyName !== undefined && { gameCurrencyName: input.gameCurrencyName }),
  ...(input.fulfillmentType !== undefined && { fulfillmentType: input.fulfillmentType }),
  ...(input.instructions !== undefined && { instructions: input.instructions }),
  ...(input.estimatedDelivery !== undefined && { estimatedDelivery: input.estimatedDelivery }),
  ...(input.termsAndConditions !== undefined && { termsAndConditions: input.termsAndConditions }),
  ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
  ...(input.isActive !== undefined && { status: input.isActive ? ProductStatus.ACTIVE : ProductStatus.INACTIVE }),
  ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
  ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
});

const packageData = (input: CreatePackageInput | UpdatePackageInput) => ({
  ...(input.name !== undefined && { title: input.name }),
  ...(input.providerProductId !== undefined && { providerProductId: input.providerProductId }),
  ...(input.coinAmount !== undefined && { gameCurrencyAmount: input.coinAmount }),
  ...(input.bonusAmount !== undefined && { bonusCurrencyAmount: input.bonusAmount }),
  ...(input.priceBdt !== undefined && { sellingPriceBDT: input.priceBdt }),
  ...(input.costPriceBdt !== undefined && { costPriceBDT: input.costPriceBdt }),
  ...(input.discountAmountBdt !== undefined && { discountAmountBDT: input.discountAmountBdt }),
  ...(input.discountPercent !== undefined && { discountPercent: input.discountPercent }),
  ...(input.discountLabel !== undefined && { discountLabel: input.discountLabel }),
  ...(input.isActive !== undefined && { isActive: input.isActive }),
  ...(input.isPopular !== undefined && { isPopular: input.isPopular }),
  ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
  ...(input.stockQuantity !== undefined && { stockQuantity: input.stockQuantity }),
});

const fieldData = (input: CreateAccountFieldInput | UpdateAccountFieldInput) => ({
  ...(input.key !== undefined && { name: input.key }),
  ...(input.label !== undefined && { label: input.label }),
  ...(input.type !== undefined && { type: input.type }),
  ...(input.placeholder !== undefined && { placeholder: input.placeholder }),
  ...(input.helpText !== undefined && { helpText: input.helpText }),
  ...(input.required !== undefined && { isRequired: input.required }),
  ...(input.options !== undefined && { options: input.options as Prisma.InputJsonValue }),
  ...(input.validationRules !== undefined && { validationRules: input.validationRules as Prisma.InputJsonValue }),
  ...(input.isActive !== undefined && { isActive: input.isActive }),
  ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
});

const listPublicGames = async (query: PageQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const where: Prisma.GameTopUpProductWhereInput = {
    status: ProductStatus.ACTIVE, deletedAt: null,
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.search && { OR: ["name", "title", "slug"].map((key) => ({ [key]: { contains: query.search, mode: "insensitive" } })) }),
  };
  const [data, total] = await prismaC.$transaction([
    prismaC.gameTopUpProduct.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], include: publicInclude }),
    prismaC.gameTopUpProduct.count({ where }),
  ]);
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
};

const getPublicGame = async (slugOrId: string) => {
  const game = await prismaC.gameTopUpProduct.findFirst({ where: { OR: [{ id: slugOrId }, { slug: slugOrId }], status: ProductStatus.ACTIVE, deletedAt: null }, include: publicInclude });
  if (!game) throw gameTopUpError(404, "GAME_NOT_FOUND", "Game not found");
  return game;
};

const listPublicPackages = async (gameId: string) => (await getPublicGame(gameId)).packages;
const listPublicAccountFields = async (gameId: string) => (await getPublicGame(gameId)).inputFields;

const listAdminGames = async (query: PageQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const where: Prisma.GameTopUpProductWhereInput = {
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.search && { OR: ["name", "title", "slug"].map((key) => ({ [key]: { contains: query.search, mode: "insensitive" } })) }),
  };
  const [data, total] = await prismaC.$transaction([
    prismaC.gameTopUpProduct.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], include: adminInclude }),
    prismaC.gameTopUpProduct.count({ where }),
  ]);
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
};

const getAdminGame = async (id: string) => {
  await assertGame(id);
  return prismaC.gameTopUpProduct.findUnique({ where: { id }, include: adminInclude });
};

const createGame = async (actorId: string, input: CreateGameInput) => {
  const game = await prismaC.gameTopUpProduct.create({ data: { ...gameData(input), title: input.title ?? input.name, createdById: actorId, updatedById: actorId } as Prisma.GameTopUpProductUncheckedCreateInput, include: adminInclude });
  await audit(actorId, "GAME_CREATED", "GameTopUpProduct", game.id);
  return game;
};

const updateGame = async (actorId: string, id: string, input: UpdateGameInput) => {
  await assertGame(id);
  const game = await prismaC.gameTopUpProduct.update({ where: { id }, data: { ...gameData(input), updatedById: actorId }, include: adminInclude });
  await audit(actorId, "GAME_UPDATED", "GameTopUpProduct", id);
  return game;
};

const archiveGame = async (actorId: string, id: string) => {
  await assertGame(id);
  const game = await prismaC.gameTopUpProduct.update({ where: { id }, data: { status: ProductStatus.ARCHIVED, deletedAt: new Date(), updatedById: actorId } });
  await audit(actorId, "GAME_ARCHIVED", "GameTopUpProduct", id);
  return game;
};

const createPackage = async (actorId: string, gameId: string, input: CreatePackageInput) => {
  await assertGame(gameId);
  const item = await prismaC.gameTopUpPackage.create({ data: { gameTopUpProductId: gameId, ...packageData(input) } as Prisma.GameTopUpPackageUncheckedCreateInput });
  await audit(actorId, "GAME_TOP_UP_PACKAGE_CREATED", "GameTopUpPackage", item.id, { gameId });
  return item;
};

const listPackages = async (gameId: string) => {
  await assertGame(gameId);
  return prismaC.gameTopUpPackage.findMany({ where: { gameTopUpProductId: gameId }, orderBy: [{ sortOrder: "asc" }, { gameCurrencyAmount: "asc" }] });
};

const getPackage = (id: string) => assertPackage(id);

const updatePackage = async (actorId: string, id: string, input: UpdatePackageInput) => {
  await assertPackage(id);
  const item = await prismaC.gameTopUpPackage.update({ where: { id }, data: packageData(input) });
  await audit(actorId, "GAME_TOP_UP_PACKAGE_UPDATED", "GameTopUpPackage", id);
  return item;
};

const deactivatePackage = async (actorId: string, id: string) => {
  await assertPackage(id);
  const item = await prismaC.gameTopUpPackage.update({ where: { id }, data: { isActive: false } });
  await audit(actorId, "GAME_TOP_UP_PACKAGE_DEACTIVATED", "GameTopUpPackage", id);
  return item;
};

const createAccountField = async (actorId: string, gameId: string, input: CreateAccountFieldInput) => {
  await assertGame(gameId);
  const field = await prismaC.gameTopUpInputField.create({ data: { gameTopUpProductId: gameId, ...fieldData(input) } as Prisma.GameTopUpInputFieldUncheckedCreateInput });
  await audit(actorId, "GAME_ACCOUNT_FIELD_CREATED", "GameTopUpInputField", field.id, { gameId });
  return field;
};

const listAccountFields = async (gameId: string) => {
  await assertGame(gameId);
  return prismaC.gameTopUpInputField.findMany({ where: { gameTopUpProductId: gameId }, orderBy: { sortOrder: "asc" } });
};

const updateAccountField = async (actorId: string, id: string, input: UpdateAccountFieldInput) => {
  await assertField(id);
  const field = await prismaC.gameTopUpInputField.update({ where: { id }, data: fieldData(input) });
  await audit(actorId, "GAME_ACCOUNT_FIELD_UPDATED", "GameTopUpInputField", id);
  return field;
};

const deactivateAccountField = async (actorId: string, id: string) => {
  await assertField(id);
  const field = await prismaC.gameTopUpInputField.update({ where: { id }, data: { isActive: false } });
  await audit(actorId, "GAME_ACCOUNT_FIELD_DEACTIVATED", "GameTopUpInputField", id);
  return field;
};

// Compatibility exports retain the existing product aggregation contract.
const getTopUps = listPublicGames;
const getTopUpById = getPublicGame;
const legacyGameInput = (payload: Record<string, any>) => createGameSchema.parse({
  name: payload.name ?? payload.title,
  title: payload.title ?? payload.name,
  slug: payload.slug,
  description: payload.description,
  subHeading: payload.subHeading,
  logoUrl: payload.logoUrl ?? payload.logo ?? payload.image ?? payload.thumbnail,
  bannerUrl: payload.bannerUrl ?? payload.bannerImage ?? payload.banner,
  gameCurrencyName: payload.gameCurrencyName,
  fulfillmentType: payload.fulfillmentType === "LOGIN_CREDENTIALS"
    ? GameTopUpFulfillmentType.ACCOUNT_ACCESS_REQUIRED
    : payload.fulfillmentType,
  instructions: payload.instructions,
  estimatedDelivery: payload.estimatedDelivery,
  termsAndConditions: payload.termsAndConditions,
  categoryId: payload.categoryId,
  isActive: payload.isActive ?? (payload.status ? payload.status === ProductStatus.ACTIVE : undefined),
  isFeatured: payload.isFeatured,
  sortOrder: payload.sortOrder,
});

const createTopUp = async (payload: Record<string, any>, userId?: string) => {
  if (!userId) throw gameTopUpError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  const game = legacyGameInput(payload);
  const rawPackages = payload.packages ?? payload.topUpAmounts ?? [];
  const packages = rawPackages.map((item: Record<string, any>, index: number) => createPackageSchema.parse({
    name: item.name ?? item.title ?? `${item.gameCurrencyAmount ?? item.gameCurrency} ${game.gameCurrencyName}`,
    coinAmount: Number(item.coinAmount ?? item.gameCurrencyAmount ?? item.gameCurrency),
    bonusAmount: Number(item.bonusAmount ?? item.bonusCurrencyAmount ?? 0),
    priceBdt: String(item.priceBdt ?? item.sellingPriceBDT ?? item.price ?? item.realCurrency),
    costPriceBdt: item.costPriceBDT == null ? undefined : String(item.costPriceBDT),
    isActive: item.isActive,
    isPopular: item.isPopular ?? item.popular,
    sortOrder: item.sortOrder ?? index,
    stockQuantity: item.stockQuantity,
  }));
  const fields = (payload.inputFields ?? []).map((item: Record<string, any>, index: number) => createAccountFieldSchema.parse({
    key: item.key ?? item.name,
    label: item.label,
    type: item.type,
    placeholder: item.placeholder,
    helpText: item.helpText,
    required: item.required ?? item.isRequired,
    options: item.options,
    validationRules: item.validationRules,
    isActive: item.isActive,
    sortOrder: item.sortOrder ?? index,
  }));
  return prismaC.$transaction(async (tx) => {
    const created = await tx.gameTopUpProduct.create({
      data: {
        ...gameData(game), title: game.title ?? game.name, createdById: userId, updatedById: userId,
        packages: { create: packages.map(packageData) },
        inputFields: { create: fields.map(fieldData) },
      } as Prisma.GameTopUpProductUncheckedCreateInput,
      include: adminInclude,
    });
    await tx.auditLog.create({ data: { actorId: userId, action: "GAME_CREATED", entityType: "GameTopUpProduct", entityId: created.id } });
    return created;
  });
};
const updateTopUp = (id: string, payload: Record<string, any>, userId?: string) => {
  if (!userId) throw gameTopUpError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  if (payload.packages || payload.topUpAmounts || payload.inputFields) {
    throw gameTopUpError(409, "NESTED_CATALOG_UPDATE_FORBIDDEN", "Update packages and account fields through their dedicated endpoints");
  }
  const normalized = legacyGameInput({
    name: payload.name ?? payload.title ?? "placeholder",
    slug: payload.slug ?? "placeholder",
    logoUrl: payload.logoUrl ?? payload.logo ?? payload.image ?? payload.thumbnail ?? "placeholder",
    gameCurrencyName: payload.gameCurrencyName ?? "placeholder",
    fulfillmentType: payload.fulfillmentType ?? GameTopUpFulfillmentType.MANUAL,
    ...payload,
  });
  const allowed = Object.fromEntries(Object.keys(payload).flatMap((key) => {
    const map: Record<string, keyof CreateGameInput> = { logo: "logoUrl", image: "logoUrl", thumbnail: "logoUrl", bannerImage: "bannerUrl", banner: "bannerUrl" };
    const target = map[key] ?? key as keyof CreateGameInput;
    return target in normalized ? [[target, normalized[target]]] : [];
  }));
  return updateGame(userId, id, updateGameSchema.parse(allowed));
};
const deleteTopUp = (id: string, userId?: string) => {
  if (!userId) throw gameTopUpError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return archiveGame(userId, id);
};

export const gameTopUpServices = {
  listPublicGames, getPublicGame, listPublicPackages, listPublicAccountFields,
  listAdminGames, getAdminGame, createGame, updateGame, archiveGame,
  createPackage, listPackages, getPackage, updatePackage, deactivatePackage,
  createAccountField, listAccountFields, updateAccountField, deactivateAccountField,
  getTopUps, getTopUpById, createTopUp, updateTopUp, deleteTopUp,
};
