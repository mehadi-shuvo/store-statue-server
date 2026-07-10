import { ProductType } from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";
import { productServices } from "../products/product.service";

type SubscriptionPlanPayload = {
  title: string;
  price: number;
  durationDays?: number;
  durationLabel?: string;
  isPopular?: boolean;
  popular?: boolean;
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

type SubscriptionPayload = {
  title: string;
  slug?: string;
  platformName?: string;
  description?: string;
  subHeading?: string;
  image?: string;
  photos?: string[];
  thumbnail?: string;
  bannerImage?: string;
  categoryId: string;
  price?: number;
  stockQuantity?: number;
  offerPercent?: number;
  features?: string[];
  sortOrder?: number;
  instructions?: string;
  isRenewable?: boolean;
  plans: SubscriptionPlanPayload[];
  inputFields?: InputFieldPayload[];
};

const normalizePlans = (payload: SubscriptionPayload) => {
  if (!Array.isArray(payload.plans) || payload.plans.length === 0) {
    throw new ApiAppError(400, "Subscription plans are required");
  }

  return payload.plans.map((plan, index) => {
    if (!plan.title || !plan.price) {
      throw new ApiAppError(
        400,
        `Subscription plan at index ${index} must include title and price`,
      );
    }

    return {
      title: plan.title,
      price: plan.price,
      durationDays: plan.durationDays,
      durationLabel: plan.durationLabel,
      isPopular: plan.isPopular ?? plan.popular ?? false,
      stockQuantity: plan.stockQuantity,
      sortOrder: plan.sortOrder ?? index,
      isActive: plan.isActive ?? true,
    };
  });
};

const buildProductPayload = (payload: SubscriptionPayload) => {
  const plans = normalizePlans(payload);
  const lowestPrice = Math.min(...plans.map((plan) => plan.price));
  const image = payload.thumbnail || payload.image;

  return {
    title: payload.title,
    slug: payload.slug,
    description: payload.description,
    subHeading: payload.subHeading,
    brand: payload.platformName || payload.title,
    type: ProductType.SUBSCRIPTION,
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
    subscription: {
      platformName: payload.platformName || payload.title,
      instructions: payload.instructions,
      isRenewable: payload.isRenewable ?? true,
      plans,
      inputFields:
        payload.inputFields || [
          {
            name: "accountEmail",
            label: "Account Email",
            type: "EMAIL" as const,
            isRequired: true,
            sortOrder: 0,
          },
        ],
    },
  };
};

const getSubscriptions = async (query: { page?: string; limit?: string }) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Number(query.limit) || 12, 100);
  const skip = (page - 1) * limit;

  const where = {
    type: ProductType.SUBSCRIPTION,
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

const getSubscriptionById = async (id: string) => {
  const product = await prismaC.product.findFirst({
    where: {
      id,
      type: ProductType.SUBSCRIPTION,
      isActive: true,
    },
    include: {
      category: { select: { id: true, title: true } },
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
    },
  });

  if (!product) {
    throw new ApiAppError(404, "Subscription product not found");
  }

  return product;
};

const createSubscription = async (
  payload: SubscriptionPayload,
  adminUserId?: string,
) => {
  return productServices.addProduct(buildProductPayload(payload), adminUserId);
};

const updateSubscription = async (
  id: string,
  payload: Partial<SubscriptionPayload>,
  adminUserId?: string,
) => {
  await getSubscriptionById(id);

  const productPayload = payload.plans
    ? buildProductPayload(payload as SubscriptionPayload)
    : {
        ...payload,
        brand: payload.platformName,
        type: ProductType.SUBSCRIPTION,
      };

  return productServices.updateProduct(id, productPayload, adminUserId);
};

const deleteSubscription = async (id: string) => {
  await getSubscriptionById(id);
  return productServices.deleteProduct(id);
};

export const subscriptionServices = {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
};
