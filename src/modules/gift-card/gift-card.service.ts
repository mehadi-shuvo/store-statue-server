import { ProductType } from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";
import { productServices } from "../products/product.service";

type GiftCardAmount = {
  BDT?: number;
  bdtPrice?: number;
  cardUSD?: number;
  cardValue?: number;
  popular?: boolean;
  isPopular?: boolean;
  title?: string;
  stockQuantity?: number;
  sortOrder?: number;
  isActive?: boolean;
};

type GiftCardPayload = {
  title: string;
  slug?: string;
  brand: string;
  description?: string;
  subHeading?: string;
  image?: string;
  photos?: string[];
  thumbnail?: string;
  bannerImage?: string;
  currency?: string;
  cardCurrency?: string;
  categoryId: string;
  price?: number;
  stockQuantity?: number;
  offerPercent?: number;
  features?: string[];
  sortOrder?: number;
  amounts?: GiftCardAmount[];
  denominations?: GiftCardAmount[];
};

const getCardCurrency = (payload: GiftCardPayload) => {
  if (payload.cardCurrency) {
    return payload.cardCurrency;
  }

  if (payload.currency === "$") {
    return "USD";
  }

  return payload.currency || "USD";
};

const normalizeDenominations = (payload: GiftCardPayload) => {
  const source = payload.denominations || payload.amounts || [];

  if (!Array.isArray(source) || source.length === 0) {
    throw new ApiAppError(400, "Gift card amounts are required");
  }

  const cardCurrency = getCardCurrency(payload);

  return source.map((amount, index) => {
    const bdtPrice = amount.bdtPrice ?? amount.BDT;
    const cardValue = amount.cardValue ?? amount.cardUSD;

    if (!bdtPrice || !cardValue) {
      throw new ApiAppError(
        400,
        `Gift card amount at index ${index} must include BDT and card value`,
      );
    }

    return {
      title: amount.title || `${cardCurrency} ${cardValue}`,
      bdtPrice,
      cardValue,
      cardCurrency,
      isPopular: amount.isPopular ?? amount.popular ?? false,
      stockQuantity: amount.stockQuantity,
      sortOrder: amount.sortOrder ?? index,
      isActive: amount.isActive ?? true,
    };
  });
};

const buildProductPayload = (payload: GiftCardPayload) => {
  const denominations = normalizeDenominations(payload);
  const lowestPrice = Math.min(...denominations.map((amount) => amount.bdtPrice));
  const image = payload.thumbnail || payload.image;

  return {
    title: payload.title,
    slug: payload.slug,
    description: payload.description,
    subHeading: payload.subHeading,
    brand: payload.brand,
    type: ProductType.GIFT_CARD,
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
    giftCard: {
      brand: payload.brand,
      cardCurrency: getCardCurrency(payload),
      denominations,
    },
  };
};

const getGiftCards = async (query: { page?: string; limit?: string }) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Number(query.limit) || 12, 100);
  const skip = (page - 1) * limit;

  const where = {
    type: ProductType.GIFT_CARD,
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
        giftCard: {
          include: {
            denominations: {
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

const getGiftCardById = async (id: string) => {
  const product = await prismaC.product.findFirst({
    where: {
      id,
      type: ProductType.GIFT_CARD,
      isActive: true,
    },
    include: {
      category: { select: { id: true, title: true } },
      giftCard: {
        include: {
          denominations: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!product) {
    throw new ApiAppError(404, "Gift card not found");
  }

  return product;
};

const createGiftCard = async (payload: GiftCardPayload, adminUserId?: string) => {
  return productServices.addProduct(buildProductPayload(payload), adminUserId);
};

const updateGiftCard = async (
  id: string,
  payload: Partial<GiftCardPayload>,
  adminUserId?: string,
) => {
  await getGiftCardById(id);

  const productPayload =
    payload.amounts || payload.denominations
      ? buildProductPayload(payload as GiftCardPayload)
      : {
          ...payload,
          type: ProductType.GIFT_CARD,
          brand: payload.brand,
        };

  return productServices.updateProduct(id, productPayload, adminUserId);
};

const deleteGiftCard = async (id: string) => {
  await getGiftCardById(id);
  return productServices.deleteProduct(id);
};

export const giftCardServices = {
  getGiftCards,
  getGiftCardById,
  createGiftCard,
  updateGiftCard,
  deleteGiftCard,
};
