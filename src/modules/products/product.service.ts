import { ProductType } from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";

/* ======================================================
   TYPES
====================================================== */

interface AddProductPayload {
  title: string;
  slug?: string;
  description?: string;
  subHeading?: string;
  brand?: string;
  type?: ProductType;

  price: number;
  stockQuantity: number;

  categoryId: string;

  offerPercent?: number;
  photos?: string[];
  thumbnail?: string;
  bannerImage?: string;
  features?: string[];
  currency?: string;
  sortOrder?: number;

  giftCard?: GiftCardPayload;
  gameTopUp?: GameTopUpPayload;
  subscription?: SubscriptionPayload;
}

interface UpdateProductPayload {
  title?: string;
  slug?: string;
  description?: string;
  subHeading?: string;
  brand?: string;
  type?: ProductType;

  price?: number;
  stockQuantity?: number;

  isActive?: boolean;
  categoryId?: string;

  offerPercent?: number;
  photos?: string[];
  thumbnail?: string;
  bannerImage?: string;
  features?: string[];
  currency?: string;
  sortOrder?: number;

  giftCard?: GiftCardPayload;
  gameTopUp?: GameTopUpPayload;
  subscription?: SubscriptionPayload;
}

interface GiftCardPayload {
  brand: string;
  cardCurrency?: string;
  denominations: {
    title?: string;
    bdtPrice: number;
    cardValue: number;
    cardCurrency?: string;
    isPopular?: boolean;
    stockQuantity?: number;
    sortOrder?: number;
    isActive?: boolean;
  }[];
}

interface GameTopUpPayload {
  gameName: string;
  gameCurrencyName: string;
  instructions?: string;
  packages: {
    title?: string;
    price: number;
    gameCurrencyAmount: number;
    isPopular?: boolean;
    stockQuantity?: number;
    sortOrder?: number;
    isActive?: boolean;
  }[];
  inputFields?: ProductInputFieldPayload[];
}

interface SubscriptionPayload {
  platformName: string;
  instructions?: string;
  isRenewable?: boolean;
  plans: {
    title: string;
    price: number;
    durationDays?: number;
    durationLabel?: string;
    isPopular?: boolean;
    stockQuantity?: number;
    sortOrder?: number;
    isActive?: boolean;
  }[];
  inputFields?: ProductInputFieldPayload[];
}

interface ProductInputFieldPayload {
  name: string;
  label: string;
  type?: "TEXT" | "NUMBER" | "EMAIL" | "PHONE" | "SELECT";
  placeholder?: string;
  helpText?: string;
  isRequired?: boolean;
  options?: unknown;
  sortOrder?: number;
  isActive?: boolean;
}

const productInclude = {
  category: { select: { id: true, title: true } },
  giftCard: {
    include: {
      denominations: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
  gameTopUp: {
    include: {
      packages: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" as const },
      },
      inputFields: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
  subscription: {
    include: {
      plans: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" as const },
      },
      inputFields: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
};

const ensureHasItems = (items: unknown[] | undefined, message: string) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiAppError(400, message);
  }
};

const validateDigitalPayload = (
  productType: ProductType,
  payload: Pick<AddProductPayload, "giftCard" | "gameTopUp" | "subscription">,
) => {
  if (payload.giftCard && productType !== ProductType.GIFT_CARD) {
    throw new ApiAppError(400, "Gift card details require product type GIFT_CARD");
  }

  if (payload.gameTopUp && productType !== ProductType.GAME_TOP_UP) {
    throw new ApiAppError(400, "Game top-up details require product type GAME_TOP_UP");
  }

  if (payload.subscription && productType !== ProductType.SUBSCRIPTION) {
    throw new ApiAppError(
      400,
      "Subscription details require product type SUBSCRIPTION",
    );
  }

  if (productType === ProductType.GIFT_CARD) {
    if (!payload.giftCard?.brand) {
      throw new ApiAppError(400, "Gift card brand is required");
    }

    ensureHasItems(
      payload.giftCard.denominations,
      "Gift card denominations are required",
    );
  }

  if (productType === ProductType.GAME_TOP_UP) {
    if (!payload.gameTopUp?.gameName || !payload.gameTopUp.gameCurrencyName) {
      throw new ApiAppError(400, "Game name and currency name are required");
    }

    ensureHasItems(payload.gameTopUp.packages, "Game top-up packages are required");
  }

  if (productType === ProductType.SUBSCRIPTION) {
    if (!payload.subscription?.platformName) {
      throw new ApiAppError(400, "Subscription platform name is required");
    }

    ensureHasItems(payload.subscription.plans, "Subscription plans are required");
  }
};

const validateOneDigitalDetail = (payload: AddProductPayload | UpdateProductPayload) => {
  const detailCount = [payload.giftCard, payload.gameTopUp, payload.subscription].filter(
    Boolean,
  ).length;

  if (detailCount > 1) {
    throw new ApiAppError(400, "Only one digital product detail can be provided");
  }
};

const buildProductData = (
  payload: AddProductPayload | UpdateProductPayload,
  userId?: string,
) => ({
  ...(payload.title !== undefined && { title: payload.title }),
  ...(payload.slug !== undefined && { slug: payload.slug }),
  ...(payload.description !== undefined && { description: payload.description }),
  ...(payload.subHeading !== undefined && { subHeading: payload.subHeading }),
  ...(payload.brand !== undefined && { brand: payload.brand }),
  ...(payload.type !== undefined && { type: payload.type }),
  ...(payload.price !== undefined && { price: payload.price }),
  ...(payload.stockQuantity !== undefined && { stockQuantity: payload.stockQuantity }),
  ...(payload.categoryId !== undefined && { categoryId: payload.categoryId }),
  ...(payload.offerPercent !== undefined && { offerPercent: payload.offerPercent }),
  ...(payload.photos !== undefined && { photos: payload.photos }),
  ...(payload.thumbnail !== undefined && { thumbnail: payload.thumbnail }),
  ...(payload.bannerImage !== undefined && { bannerImage: payload.bannerImage }),
  ...(payload.features !== undefined && { features: payload.features }),
  ...(payload.currency !== undefined && { currency: payload.currency }),
  ...(payload.sortOrder !== undefined && { sortOrder: payload.sortOrder }),
  ...(userId && { updatedById: userId }),
});

const clearDigitalDetails = async (
  tx: any,
  productId: string,
  keepType?: ProductType,
) => {
  if (keepType !== ProductType.GIFT_CARD) {
    const giftCard = await tx.giftCardProduct.findUnique({
      where: { productId },
      select: { id: true },
    });

    if (giftCard) {
      await tx.giftCardDenomination.deleteMany({
        where: { giftCardProductId: giftCard.id },
      });
      await tx.giftCardProduct.delete({ where: { id: giftCard.id } });
    }
  }

  if (keepType !== ProductType.GAME_TOP_UP) {
    const gameTopUp = await tx.gameTopUpProduct.findUnique({
      where: { productId },
      select: { id: true },
    });

    if (gameTopUp) {
      await tx.gameTopUpPackage.deleteMany({
        where: { gameTopUpProductId: gameTopUp.id },
      });
      await tx.gameTopUpInputField.deleteMany({
        where: { gameTopUpProductId: gameTopUp.id },
      });
      await tx.gameTopUpProduct.delete({ where: { id: gameTopUp.id } });
    }
  }

  if (keepType !== ProductType.SUBSCRIPTION) {
    const subscription = await tx.subscriptionProduct.findUnique({
      where: { productId },
      select: { id: true },
    });

    if (subscription) {
      await tx.subscriptionPlan.deleteMany({
        where: { subscriptionProductId: subscription.id },
      });
      await tx.subscriptionInputField.deleteMany({
        where: { subscriptionProductId: subscription.id },
      });
      await tx.subscriptionProduct.delete({ where: { id: subscription.id } });
    }
  }
};

/* ======================================================
   ADD PRODUCT
====================================================== */

const addProduct = async (payload: AddProductPayload, adminUserId?: string) => {
  validateOneDigitalDetail(payload);

  const productType = payload.type || ProductType.PHYSICAL;
  validateDigitalPayload(productType, payload);

  const categoryExists = await prismaC.category.findFirst({
    where: {
      id: payload.categoryId,
      isActive: true,
    },
  });

  if (!categoryExists) {
    throw new ApiAppError(404, "Category not found or inactive");
  }

  // ✅ Offer validation
  if (payload.offerPercent && payload.offerPercent > 90) {
    throw new ApiAppError(400, "Offer percentage cannot exceed 90%");
  }

  const product = await prismaC.product.create({
    data: {
      title: payload.title,
      slug: payload.slug,
      description: payload.description,
      subHeading: payload.subHeading,
      brand: payload.brand,
      type: productType,
      price: payload.price,
      stockQuantity: payload.stockQuantity,
      category: { connect: { id: payload.categoryId } },
      ...(adminUserId && {
        createdBy: { connect: { id: adminUserId } },
        updatedBy: { connect: { id: adminUserId } },
      }),
      offerPercent: payload.offerPercent || 0,
      photos: payload.photos || [],
      features: payload.features || [],
      currency: payload.currency || "BDT",
      ...(productType === ProductType.GIFT_CARD &&
        payload.giftCard && {
          giftCard: {
            create: {
              brand: payload.giftCard.brand,
              cardCurrency: payload.giftCard.cardCurrency || "USD",
              denominations: {
                create: payload.giftCard.denominations.map((denomination) => ({
                  title: denomination.title,
                  bdtPrice: denomination.bdtPrice,
                  cardValue: denomination.cardValue,
                  cardCurrency:
                    denomination.cardCurrency ||
                    payload.giftCard?.cardCurrency ||
                    "USD",
                  isPopular: denomination.isPopular || false,
                  stockQuantity: denomination.stockQuantity,
                  sortOrder: denomination.sortOrder || 0,
                  isActive: denomination.isActive ?? true,
                })),
              },
            },
          },
        }),
      ...(productType === ProductType.GAME_TOP_UP &&
        payload.gameTopUp && {
          gameTopUp: {
            create: {
              gameName: payload.gameTopUp.gameName,
              gameCurrencyName: payload.gameTopUp.gameCurrencyName,
              instructions: payload.gameTopUp.instructions,
              packages: {
                create: payload.gameTopUp.packages.map((topUpPackage) => ({
                  title: topUpPackage.title,
                  price: topUpPackage.price,
                  gameCurrencyAmount: topUpPackage.gameCurrencyAmount,
                  isPopular: topUpPackage.isPopular || false,
                  stockQuantity: topUpPackage.stockQuantity,
                  sortOrder: topUpPackage.sortOrder || 0,
                  isActive: topUpPackage.isActive ?? true,
                })),
              },
              inputFields: {
                create:
                  payload.gameTopUp.inputFields?.map((field) => ({
                    name: field.name,
                    label: field.label,
                    type: field.type || "TEXT",
                    placeholder: field.placeholder,
                    helpText: field.helpText,
                    isRequired: field.isRequired ?? true,
                    options: field.options as any,
                    sortOrder: field.sortOrder || 0,
                    isActive: field.isActive ?? true,
                  })) || [],
              },
            },
          },
        }),
      ...(productType === ProductType.SUBSCRIPTION &&
        payload.subscription && {
          subscription: {
            create: {
              platformName: payload.subscription.platformName,
              instructions: payload.subscription.instructions,
              isRenewable: payload.subscription.isRenewable ?? true,
              plans: {
                create: payload.subscription.plans.map((plan) => ({
                  title: plan.title,
                  price: plan.price,
                  durationDays: plan.durationDays,
                  durationLabel: plan.durationLabel,
                  isPopular: plan.isPopular || false,
                  stockQuantity: plan.stockQuantity,
                  sortOrder: plan.sortOrder || 0,
                  isActive: plan.isActive ?? true,
                })),
              },
              inputFields: {
                create:
                  payload.subscription.inputFields?.map((field) => ({
                    name: field.name,
                    label: field.label,
                    type: field.type || "TEXT",
                    placeholder: field.placeholder,
                    helpText: field.helpText,
                    isRequired: field.isRequired ?? true,
                    options: field.options as any,
                    sortOrder: field.sortOrder || 0,
                    isActive: field.isActive ?? true,
                  })) || [],
              },
            },
          },
        }),
    },
    include: productInclude,
  });

  return product;
};

/* ======================================================
   UPDATE PRODUCT
====================================================== */

const updateProduct = async (
  productId: string,
  payload: UpdateProductPayload,
  adminUserId?: string,
) => {
  validateOneDigitalDetail(payload);

  const productExists = await prismaC.product.findFirst({
    where: {
      id: productId,
      isActive: true,
    },
  });

  if (!productExists) {
    throw new ApiAppError(404, "Product not found");
  }

  // ✅ Category Validation
  if (payload.categoryId) {
    const categoryExists = await prismaC.category.findFirst({
      where: {
        id: payload.categoryId,
        isActive: true,
      },
    });

    if (!categoryExists) {
      throw new ApiAppError(404, "Category not found");
    }
  }

  if (payload.offerPercent && payload.offerPercent > 90) {
    throw new ApiAppError(400, "Offer percentage cannot exceed 90%");
  }

  const targetType = payload.type || productExists.type;

  if (payload.type && payload.type !== productExists.type) {
    if (payload.type === ProductType.GIFT_CARD && !payload.giftCard) {
      throw new ApiAppError(400, "Gift card details are required");
    }

    if (payload.type === ProductType.GAME_TOP_UP && !payload.gameTopUp) {
      throw new ApiAppError(400, "Game top-up details are required");
    }

    if (payload.type === ProductType.SUBSCRIPTION && !payload.subscription) {
      throw new ApiAppError(400, "Subscription details are required");
    }
  }

  if (payload.giftCard || payload.gameTopUp || payload.subscription) {
    if (payload.giftCard && targetType !== ProductType.GIFT_CARD) {
      throw new ApiAppError(400, "Gift card details require product type GIFT_CARD");
    }

    if (payload.gameTopUp && targetType !== ProductType.GAME_TOP_UP) {
      throw new ApiAppError(400, "Game top-up details require product type GAME_TOP_UP");
    }

    if (payload.subscription && targetType !== ProductType.SUBSCRIPTION) {
      throw new ApiAppError(
        400,
        "Subscription details require product type SUBSCRIPTION",
      );
    }

    validateDigitalPayload(targetType, {
      giftCard: payload.giftCard,
      gameTopUp: payload.gameTopUp,
      subscription: payload.subscription,
    });
  }

  const updatedProduct = await prismaC.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: productId },
      data: buildProductData(payload, adminUserId),
    });

    if (
      payload.type !== undefined ||
      payload.giftCard ||
      payload.gameTopUp ||
      payload.subscription
    ) {
      await clearDigitalDetails(tx, productId, targetType);
    }

    if (payload.giftCard) {
      const giftCardProduct = await tx.giftCardProduct.upsert({
        where: { productId },
        update: {
          brand: payload.giftCard.brand,
          cardCurrency: payload.giftCard.cardCurrency || "USD",
        },
        create: {
          productId,
          brand: payload.giftCard.brand,
          cardCurrency: payload.giftCard.cardCurrency || "USD",
        },
      });

      await tx.giftCardDenomination.deleteMany({
        where: { giftCardProductId: giftCardProduct.id },
      });
      await tx.giftCardDenomination.createMany({
        data: payload.giftCard.denominations.map((denomination) => ({
          giftCardProductId: giftCardProduct.id,
          title: denomination.title,
          bdtPrice: denomination.bdtPrice,
          cardValue: denomination.cardValue,
          cardCurrency:
            denomination.cardCurrency || payload.giftCard?.cardCurrency || "USD",
          isPopular: denomination.isPopular || false,
          stockQuantity: denomination.stockQuantity,
          sortOrder: denomination.sortOrder || 0,
          isActive: denomination.isActive ?? true,
        })),
      });
    }

    if (payload.gameTopUp) {
      const gameTopUpProduct = await tx.gameTopUpProduct.upsert({
        where: { productId },
        update: {
          gameName: payload.gameTopUp.gameName,
          gameCurrencyName: payload.gameTopUp.gameCurrencyName,
          instructions: payload.gameTopUp.instructions,
        },
        create: {
          productId,
          gameName: payload.gameTopUp.gameName,
          gameCurrencyName: payload.gameTopUp.gameCurrencyName,
          instructions: payload.gameTopUp.instructions,
        },
      });

      await tx.gameTopUpPackage.deleteMany({
        where: { gameTopUpProductId: gameTopUpProduct.id },
      });
      await tx.gameTopUpPackage.createMany({
        data: payload.gameTopUp.packages.map((topUpPackage) => ({
          gameTopUpProductId: gameTopUpProduct.id,
          title: topUpPackage.title,
          price: topUpPackage.price,
          gameCurrencyAmount: topUpPackage.gameCurrencyAmount,
          isPopular: topUpPackage.isPopular || false,
          stockQuantity: topUpPackage.stockQuantity,
          sortOrder: topUpPackage.sortOrder || 0,
          isActive: topUpPackage.isActive ?? true,
        })),
      });

      if (payload.gameTopUp.inputFields) {
        await tx.gameTopUpInputField.deleteMany({
          where: { gameTopUpProductId: gameTopUpProduct.id },
        });
        await tx.gameTopUpInputField.createMany({
          data: payload.gameTopUp.inputFields.map((field) => ({
            gameTopUpProductId: gameTopUpProduct.id,
            name: field.name,
            label: field.label,
            type: field.type || "TEXT",
            placeholder: field.placeholder,
            helpText: field.helpText,
            isRequired: field.isRequired ?? true,
            options: field.options as any,
            sortOrder: field.sortOrder || 0,
            isActive: field.isActive ?? true,
          })),
        });
      }
    }

    if (payload.subscription) {
      const subscriptionProduct = await tx.subscriptionProduct.upsert({
        where: { productId },
        update: {
          platformName: payload.subscription.platformName,
          instructions: payload.subscription.instructions,
          isRenewable: payload.subscription.isRenewable ?? true,
        },
        create: {
          productId,
          platformName: payload.subscription.platformName,
          instructions: payload.subscription.instructions,
          isRenewable: payload.subscription.isRenewable ?? true,
        },
      });

      await tx.subscriptionPlan.deleteMany({
        where: { subscriptionProductId: subscriptionProduct.id },
      });
      await tx.subscriptionPlan.createMany({
        data: payload.subscription.plans.map((plan) => ({
          subscriptionProductId: subscriptionProduct.id,
          title: plan.title,
          price: plan.price,
          durationDays: plan.durationDays,
          durationLabel: plan.durationLabel,
          isPopular: plan.isPopular || false,
          stockQuantity: plan.stockQuantity,
          sortOrder: plan.sortOrder || 0,
          isActive: plan.isActive ?? true,
        })),
      });

      if (payload.subscription.inputFields) {
        await tx.subscriptionInputField.deleteMany({
          where: { subscriptionProductId: subscriptionProduct.id },
        });
        await tx.subscriptionInputField.createMany({
          data: payload.subscription.inputFields.map((field) => ({
            subscriptionProductId: subscriptionProduct.id,
            name: field.name,
            label: field.label,
            type: field.type || "TEXT",
            placeholder: field.placeholder,
            helpText: field.helpText,
            isRequired: field.isRequired ?? true,
            options: field.options as any,
            sortOrder: field.sortOrder || 0,
            isActive: field.isActive ?? true,
          })),
        });
      }
    }

    return tx.product.findUnique({
      where: { id: product.id },
      include: productInclude,
    });
  });

  return updatedProduct;
};

/* ======================================================
   DELETE PRODUCT (SOFT DELETE)
====================================================== */

const deleteProduct = async (productId: string) => {
  const productExists = await prismaC.product.findFirst({
    where: {
      id: productId,
      isActive: true,
    },
  });

  if (!productExists) {
    throw new ApiAppError(404, "Product not found");
  }

  const deletedProduct = await prismaC.product.update({
    where: { id: productId },
    data: { isActive: false },
  });

  return deletedProduct;
};

/* ======================================================
   GET PRODUCTS (SEARCH + FILTER + PAGINATION)
====================================================== */

type SortField = "createdAt" | "price" | "title";
type SortOrder = "asc" | "desc";

const ALLOWED_SORT_FIELDS: SortField[] = ["createdAt", "price", "title"];
const ALLOWED_SORT_ORDER: SortOrder[] = ["asc", "desc"];

interface GetProductsQuery {
  search?: string;
  categories?: string;
  type?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;

  sort?: string;
  order?: string;

  page?: string;
  limit?: string;
}
const getProducts = async (query: GetProductsQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Number(query.limit) || 12, 100);
  const skip = (page - 1) * limit;

  const sortField: SortField = ALLOWED_SORT_FIELDS.includes(query.sort as any)
    ? (query.sort as SortField)
    : "createdAt";

  const sortOrder: SortOrder = ALLOWED_SORT_ORDER.includes(query.order as any)
    ? (query.order as SortOrder)
    : "desc";

  const where: any = {
    isActive: true,
  };

  // ✅ Search
  if (query.search?.trim()) {
    const search = query.search.trim();

    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  // ✅ Category
  const categoryIds = query.categories
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (categoryIds?.length) {
    where.categoryId = { in: categoryIds };
  }

  if (
    query.type &&
    Object.values(ProductType).includes(query.type as ProductType)
  ) {
    where.type = query.type;
  }

  if (query.brand?.trim()) {
    where.brand = { equals: query.brand.trim(), mode: "insensitive" };
  }

  // ✅ Price
  const minPrice = query.minPrice ? Number(query.minPrice) : undefined;
  const maxPrice = query.maxPrice ? Number(query.maxPrice) : undefined;

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {
      ...(minPrice !== undefined && { gte: minPrice }),
      ...(maxPrice !== undefined && { lte: maxPrice }),
    };
  }

  // ✅ Stock
  if (query.inStock === "true") {
    where.stockQuantity = { gt: 0 };
  }

  const [products, total] = await prismaC.$transaction([
    prismaC.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortField]: sortOrder },
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
        reviews: { select: { rating: true } },
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
/* ======================================================
   GET SINGLE PRODUCT + RELATED PRODUCTS
====================================================== */

const RELATED_PRODUCTS_LIMIT = 6;

const getSingleProductWithRelated = async (productId: string) => {
  // ✅ Main Product
  const product = await prismaC.product.findFirst({
    where: {
      id: productId,
      isActive: true,
    },
    include: {
      category: {
        select: {
          id: true,
          title: true,
        },
      },
      giftCard: {
        include: {
          denominations: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
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

      // ✅ Reviews Include
      reviews: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    throw new ApiAppError(404, "Product not found");
  }

  // ✅ Related Products
  const relatedProducts = await prismaC.product.findMany({
    where: {
      isActive: true,
      categoryId: product.categoryId,
      NOT: { id: product.id },
    },
    take: RELATED_PRODUCTS_LIMIT,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      brand: true,
      price: true,
      stockQuantity: true,

      // ✅ New Fields
      offerPercent: true,
      photos: true,
    },
  });

  return {
    product,
    relatedProducts,
  };
};

/* ======================================================
   BULK UPLOAD PRODUCTS (DEV ONLY)
====================================================== */

interface BulkUploadProductPayload {
  title: string;
  description?: string;

  price: number;
  stockQuantity: number;
  categoryId: string;

  offerPercent?: number;
  photos?: string[];
  features?: string[];
}

const bulkUploadProducts = async (products: BulkUploadProductPayload[]) => {
  if (!products || products.length === 0) {
    throw new ApiAppError(400, "No products provided for bulk upload");
  }

  if (products.length > 20) {
    throw new ApiAppError(
      400,
      "Bulk upload limit exceeded (max 200 products at once)",
    );
  }

  // ✅ Validate Categories (all unique categoryIds)
  const categoryIds = [...new Set(products.map((p) => p.categoryId))];

  const validCategories = await prismaC.category.findMany({
    where: {
      id: { in: categoryIds },
      isActive: true,
    },
    select: { id: true },
  });

  const validCategorySet = new Set(
    validCategories.map((category: { id: string }) => category.id),
  );

  // ❌ Check invalid categories
  const invalidCategories = categoryIds.filter(
    (id) => !validCategorySet.has(id),
  );

  if (invalidCategories.length > 0) {
    throw new ApiAppError(
      404,
      `Invalid category IDs: ${invalidCategories.join(", ")}`,
    );
  }

  // ✅ Prepare Data
  const formattedProducts = products.map((p) => ({
    title: p.title,
    description: p.description,

    price: p.price,
    stockQuantity: p.stockQuantity,

    categoryId: p.categoryId,

    offerPercent: p.offerPercent || 0,
    photos: p.photos || [],
    features: p.features || [],
  }));

  // ✅ Bulk Insert (FAST)
  const result = await prismaC.product.createMany({
    data: formattedProducts,
    skipDuplicates: true, // avoids duplicate title errors if unique constraint exists
  });

  return {
    message: "Bulk product upload successful (DEV MODE)",
    insertedCount: result.count,
  };
};

/* ======================================================
   EXPORT SERVICES
====================================================== */

export const productServices = {
  addProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getSingleProductWithRelated,
  bulkUploadProducts,
};
