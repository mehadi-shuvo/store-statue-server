import {
  ProductStatus,
  type Prisma,
} from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";
import { gameTopUpServices } from "../game-top-up/game-top-up.service";
import { giftCardServices } from "../gift-card/gift-card.service";
import { subscriptionServices } from "../subscription/subscription.service";

type Payload = Record<string, any>;

const normalizeType = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_");

const serviceFor = (type: unknown) => {
  switch (normalizeType(type)) {
    case "GIFT_CARD":
      return {
        create: giftCardServices.createGiftCard,
        update: giftCardServices.updateGiftCard,
        remove: giftCardServices.deleteGiftCard,
      };
    case "GAME_TOP_UP":
      return {
        create: gameTopUpServices.createTopUp,
        update: gameTopUpServices.updateTopUp,
        remove: gameTopUpServices.deleteTopUp,
      };
    case "SUBSCRIPTION":
      return {
        create: subscriptionServices.createSubscription,
        update: subscriptionServices.updateSubscription,
        remove: subscriptionServices.deleteSubscription,
      };
    default:
      throw new ApiAppError(
        400,
        "type must be GIFT_CARD, GAME_TOP_UP or SUBSCRIPTION",
      );
  }
};

const unwrapPayload = (payload: Payload) => {
  const type = normalizeType(payload.type ?? payload.productType);
  const detail =
    type === "GIFT_CARD"
      ? payload.giftCard
      : type === "GAME_TOP_UP"
        ? payload.gameTopUp
        : type === "SUBSCRIPTION"
          ? payload.subscription
          : undefined;
  return { ...payload, ...(detail ?? {}), type };
};

const addProduct = async (payload: Payload, userId?: string) => {
  const normalized = unwrapPayload(payload);
  return serviceFor(normalized.type).create(normalized, userId);
};

const findProductType = async (id: string, includeInactive = true) => {
  const [giftCard, gameTopUp, subscription] = await Promise.all([
    prismaC.giftCardProduct.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null, ...(includeInactive ? {} : { status: "ACTIVE" }) },
      select: { id: true },
    }),
    prismaC.gameTopUpProduct.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null, ...(includeInactive ? {} : { status: "ACTIVE" }) },
      select: { id: true },
    }),
    prismaC.subscriptionProduct.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null, ...(includeInactive ? {} : { status: "ACTIVE" }) },
      select: { id: true },
    }),
  ]);
  if (giftCard) return { type: "GIFT_CARD", id: giftCard.id };
  if (gameTopUp) return { type: "GAME_TOP_UP", id: gameTopUp.id };
  if (subscription) return { type: "SUBSCRIPTION", id: subscription.id };
  throw new ApiAppError(404, "Product not found");
};

const updateProduct = async (id: string, payload: Payload, userId?: string) => {
  const current = await findProductType(id);
  const normalized = unwrapPayload({ ...payload, type: payload.type ?? current.type });
  if (normalized.type !== current.type) {
    throw new ApiAppError(400, "Changing a product type is not supported");
  }
  return serviceFor(current.type).update(current.id, normalized, userId);
};

const deleteProduct = async (id: string, userId?: string) => {
  const current = await findProductType(id);
  if (current.type === "GAME_TOP_UP") {
    return gameTopUpServices.deleteTopUp(current.id, userId);
  }
  return serviceFor(current.type).remove(current.id);
};

const getProducts = async (query: Payload) => {
  const type = normalizeType(query.type ?? query.productType);
  if (type === "GIFT_CARD") return giftCardServices.getGiftCards(query);
  if (type === "GAME_TOP_UP") return gameTopUpServices.getTopUps(query);
  if (type === "SUBSCRIPTION") return subscriptionServices.getSubscriptions(query);
  if (type) {
    throw new ApiAppError(
      400,
      "type must be GIFT_CARD, GAME_TOP_UP or SUBSCRIPTION",
    );
  }

  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
  const take = page * limit;
  if (query.status && !Object.values(ProductStatus).includes(query.status)) {
    throw new ApiAppError(400, "Invalid product status");
  }
  if (query.isFeatured !== undefined && !["true", "false"].includes(String(query.isFeatured))) {
    throw new ApiAppError(400, "isFeatured must be true or false");
  }

  const sharedWhere = {
    deletedAt: null,
    status: query.status ?? ProductStatus.ACTIVE,
    ...(query.categoryId ? { categoryId: String(query.categoryId) } : {}),
    ...(query.isFeatured !== undefined
      ? { isFeatured: String(query.isFeatured) === "true" }
      : {}),
  };
  const giftCardWhere: Prisma.GiftCardProductWhereInput = {
    ...sharedWhere,
    ...(query.search
      ? {
          OR: ["title", "brand", "slug"].map((field) => ({
            [field]: { contains: String(query.search), mode: "insensitive" as const },
          })),
        }
      : {}),
  };
  const topUpWhere: Prisma.GameTopUpProductWhereInput = {
    ...sharedWhere,
    ...(query.search
      ? {
          OR: ["title", "name", "slug"].map((field) => ({
            [field]: { contains: String(query.search), mode: "insensitive" as const },
          })),
        }
      : {}),
  };
  const subscriptionWhere: Prisma.SubscriptionProductWhereInput = {
    ...sharedWhere,
    ...(query.search
      ? {
          OR: ["title", "platformName", "slug"].map((field) => ({
            [field]: { contains: String(query.search), mode: "insensitive" as const },
          })),
        }
      : {}),
  };
  const category = { select: { id: true, title: true, slug: true } } as const;
  const [giftCards, topUps, subscriptions, giftCardTotal, topUpTotal, subscriptionTotal] =
    await Promise.all([
      prismaC.giftCardProduct.findMany({
        where: giftCardWhere,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          category,
          denominations: { orderBy: { sortOrder: "asc" } },
        },
      }),
      prismaC.gameTopUpProduct.findMany({
        where: topUpWhere,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          category,
          packages: { orderBy: { sortOrder: "asc" } },
          inputFields: { orderBy: { sortOrder: "asc" } },
        },
      }),
      prismaC.subscriptionProduct.findMany({
        where: subscriptionWhere,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          category,
          plans: { orderBy: { sortOrder: "asc" } },
          inputFields: { orderBy: { sortOrder: "asc" } },
        },
      }),
      prismaC.giftCardProduct.count({ where: giftCardWhere }),
      prismaC.gameTopUpProduct.count({ where: topUpWhere }),
      prismaC.subscriptionProduct.count({ where: subscriptionWhere }),
    ]);
  const data = [
    ...giftCards.map((item) => ({ ...item, productType: "GIFT_CARD" })),
    ...topUps.map((item) => ({ ...item, productType: "GAME_TOP_UP" })),
    ...subscriptions.map((item) => ({ ...item, productType: "SUBSCRIPTION" })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const total = giftCardTotal + topUpTotal + subscriptionTotal;
  return {
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    data: data.slice((page - 1) * limit, page * limit),
  };
};

const getSingleProductWithRelated = async (id: string) => {
  const current = await findProductType(id, false);
  if (current.type === "GIFT_CARD") {
    return {
      ...(await giftCardServices.getGiftCardById(current.id)),
      productType: current.type,
    };
  }
  if (current.type === "GAME_TOP_UP") {
    return {
      ...(await gameTopUpServices.getTopUpById(current.id)),
      productType: current.type,
    };
  }
  return {
    ...(await subscriptionServices.getSubscriptionById(current.id)),
    productType: current.type,
  };
};

const bulkUploadProducts = async (products: Payload[], userId?: string) => {
  if (!Array.isArray(products) || products.length === 0) {
    throw new ApiAppError(400, "products must be a non-empty array");
  }
  const data = [];
  for (const product of products) {
    data.push(await addProduct(product, userId));
  }
  return {
    message: `${data.length} products created successfully`,
    count: data.length,
    data,
  };
};

export const productServices = {
  addProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getSingleProductWithRelated,
  bulkUploadProducts,
};
