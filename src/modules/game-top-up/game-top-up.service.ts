import { ProductType } from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";
import { productServices } from "../products/product.service";

type TopUpAmount = {
  realCurrency?: number;
  price?: number;
  gameCurrency?: number;
  gameCurrencyAmount?: number;
  popular?: boolean;
  isPopular?: boolean;
  title?: string;
  stockQuantity?: number;
  sortOrder?: number;
  isActive?: boolean;
};

type InputFieldPayload = {
  name: string;
  label: string;
  type?: "TEXT" | "NUMBER" | "EMAIL" | "PHONE" | "SELECT";
  placeholder?: string;
  helpText?: string;
  isRequired?: boolean;
  options?: unknown;
  sortOrder?: number;
  isActive?: boolean;
};

type GameTopUpPayload = {
  title?: string;
  name?: string;
  slug?: string;
  description?: string;
  subHeading?: string;
  logo?: string;
  image?: string;
  banner?: string;
  photos?: string[];
  categoryId: string;
  price?: number;
  stockQuantity?: number;
  offerPercent?: number;
  features?: string[];
  sortOrder?: number;
  gameCurrencyName: string;
  instructions?: string;
  topUpAmounts?: TopUpAmount[];
  packages?: TopUpAmount[];
  inputFields?: InputFieldPayload[];
};

const normalizePackages = (payload: GameTopUpPayload) => {
  const source = payload.packages || payload.topUpAmounts || [];

  if (!Array.isArray(source) || source.length === 0) {
    throw new ApiAppError(400, "Top-up packages are required");
  }

  return source.map((amount, index) => {
    const price = amount.price ?? amount.realCurrency;
    const gameCurrencyAmount =
      amount.gameCurrencyAmount ?? amount.gameCurrency;

    if (!price || !gameCurrencyAmount) {
      throw new ApiAppError(
        400,
        `Top-up amount at index ${index} must include price and game currency`,
      );
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

const buildProductPayload = (payload: GameTopUpPayload) => {
  const packages = normalizePackages(payload);
  const lowestPrice = Math.min(...packages.map((amount) => amount.price));
  const title = payload.title || payload.name;
  const image = payload.logo || payload.image;

  if (!title) {
    throw new ApiAppError(400, "Top-up title or name is required");
  }

  return {
    title,
    slug: payload.slug,
    description: payload.description,
    subHeading: payload.subHeading,
    brand: payload.name || title,
    type: ProductType.GAME_TOP_UP,
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
      inputFields:
        payload.inputFields || [
          {
            name: "playerId",
            label: "Player ID",
            type: "TEXT" as const,
            isRequired: true,
            sortOrder: 0,
          },
        ],
    },
  };
};

const getTopUps = async (query: { page?: string; limit?: string }) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Number(query.limit) || 12, 100);
  const skip = (page - 1) * limit;

  const where = {
    type: ProductType.GAME_TOP_UP,
    isActive: true,
  };

  const [products, total] = await prismaC.$transaction([
    prismaC.product.findMany({
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
    prismaC.product.count({ where }),
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

const getTopUpById = async (id: string) => {
  const product = await prismaC.product.findFirst({
    where: {
      id,
      type: ProductType.GAME_TOP_UP,
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
    throw new ApiAppError(404, "Top-up product not found");
  }

  return product;
};

const createTopUp = async (payload: GameTopUpPayload, adminUserId?: string) => {
  return productServices.addProduct(buildProductPayload(payload), adminUserId);
};

const updateTopUp = async (
  id: string,
  payload: Partial<GameTopUpPayload>,
  adminUserId?: string,
) => {
  await getTopUpById(id);

  const productPayload =
    payload.packages || payload.topUpAmounts
      ? buildProductPayload(payload as GameTopUpPayload)
      : {
          ...payload,
          title: payload.title || payload.name,
          brand: payload.name,
          type: ProductType.GAME_TOP_UP,
        };

  return productServices.updateProduct(id, productPayload, adminUserId);
};

const deleteTopUp = async (id: string) => {
  await getTopUpById(id);
  return productServices.deleteProduct(id);
};

export const gameTopUpServices = {
  getTopUps,
  getTopUpById,
  createTopUp,
  updateTopUp,
  deleteTopUp,
};
