import {
  DigitalProductType,
  ProductStatus,
  type Prisma,
} from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";

const cartItemInclude = {
  giftCardProduct: true,
  giftCardDenomination: true,
  gameTopUpProduct: true,
  gameTopUpPackage: true,
  subscriptionProduct: true,
  subscriptionPlan: true,
} satisfies Prisma.CartItemInclude;

type CartItemPayload = {
  userId: string;
  productId: string;
  giftCardDenominationId?: string;
  gameTopUpPackageId?: string;
  subscriptionPlanId?: string;
};

const getProductType = (payload: CartItemPayload) => {
  const selectedOptions = [
    payload.giftCardDenominationId,
    payload.gameTopUpPackageId,
    payload.subscriptionPlanId,
  ].filter((value): value is string => Boolean(value));

  if (!payload.productId || selectedOptions.length !== 1) {
    throw new ApiAppError(
      400,
      "productId and exactly one digital product option are required",
    );
  }

  if (payload.giftCardDenominationId) return DigitalProductType.GIFT_CARD;
  if (payload.gameTopUpPackageId) return DigitalProductType.GAME_TOP_UP;
  return DigitalProductType.SUBSCRIPTION;
};

const getOptionKey = (payload: CartItemPayload) => {
  if (payload.giftCardDenominationId) {
    return `gift-card:${payload.giftCardDenominationId}`;
  }
  if (payload.gameTopUpPackageId) {
    return `game-top-up:${payload.gameTopUpPackageId}`;
  }
  return `subscription:${payload.subscriptionPlanId}`;
};

const itemMatchesProduct = (
  item: {
    giftCardProductId: string | null;
    gameTopUpProductId: string | null;
    subscriptionProductId: string | null;
  },
  productType: DigitalProductType,
  productId: string,
) => {
  if (productType === DigitalProductType.GIFT_CARD) {
    return item.giftCardProductId === productId;
  }
  if (productType === DigitalProductType.GAME_TOP_UP) {
    return item.gameTopUpProductId === productId;
  }
  return item.subscriptionProductId === productId;
};

const getOrCreateCart = async (userId: string) => {
  const existingCart = await prismaC.cart.findUnique({
    where: { userId },
    include: { items: { include: cartItemInclude } },
  });

  if (existingCart) return existingCart;

  return prismaC.cart.create({
    data: { userId },
    include: { items: { include: cartItemInclude } },
  });
};

const resolveProductOption = async (payload: CartItemPayload) => {
  const productType = getProductType(payload);

  if (productType === DigitalProductType.GIFT_CARD) {
    const option = await prismaC.giftCardDenomination.findFirst({
      where: {
        id: payload.giftCardDenominationId,
        giftCardProductId: payload.productId,
        isActive: true,
        giftCardProduct: {
          is: { status: ProductStatus.ACTIVE, deletedAt: null },
        },
      },
    });
    if (!option) throw new ApiAppError(404, "Gift card denomination not found");
    return {
      productType,
      unitPrice: option.sellingPriceBDT,
      stockQuantity: option.stockQuantity,
    };
  }

  if (productType === DigitalProductType.GAME_TOP_UP) {
    const option = await prismaC.gameTopUpPackage.findFirst({
      where: {
        id: payload.gameTopUpPackageId,
        gameTopUpProductId: payload.productId,
        isActive: true,
        gameTopUpProduct: {
          is: { status: ProductStatus.ACTIVE, deletedAt: null },
        },
      },
    });
    if (!option) throw new ApiAppError(404, "Game top-up package not found");
    return {
      productType,
      unitPrice: option.sellingPriceBDT,
      stockQuantity: option.stockQuantity,
    };
  }

  const option = await prismaC.subscriptionPlan.findFirst({
    where: {
      id: payload.subscriptionPlanId,
      subscriptionProductId: payload.productId,
      isActive: true,
      subscriptionProduct: {
        is: { status: ProductStatus.ACTIVE, deletedAt: null },
      },
    },
  });
  if (!option) throw new ApiAppError(404, "Subscription plan not found");
  return {
    productType,
    unitPrice: option.sellingPriceBDT,
    stockQuantity: option.stockQuantity,
  };
};

const addToCart = async (
  payload: CartItemPayload & {
    customerInputs?: Prisma.InputJsonValue;
    quantity: number;
  },
) => {
  if (!Number.isInteger(payload.quantity) || payload.quantity <= 0) {
    throw new ApiAppError(400, "Quantity must be a positive integer");
  }

  const option = await resolveProductOption(payload);
  if (option.stockQuantity !== null && option.stockQuantity < payload.quantity) {
    throw new ApiAppError(400, "Insufficient product stock");
  }

  const cart = await getOrCreateCart(payload.userId);
  const optionKey = getOptionKey(payload);
  const existingItem = await prismaC.cartItem.findUnique({
    where: {
      cartId_productType_optionKey: {
        cartId: cart.id,
        productType: option.productType,
        optionKey,
      },
    },
  });

  if (existingItem) {
    if (!itemMatchesProduct(existingItem, option.productType, payload.productId)) {
      throw new ApiAppError(409, "Cart option conflicts with another product");
    }

    const newQuantity = existingItem.quantity + payload.quantity;
    if (option.stockQuantity !== null && option.stockQuantity < newQuantity) {
      throw new ApiAppError(400, "Stock limit exceeded");
    }

    return prismaC.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: newQuantity,
        unitPrice: option.unitPrice,
        ...(payload.customerInputs !== undefined
          ? { customerInputs: payload.customerInputs }
          : {}),
      },
      include: cartItemInclude,
    });
  }

  return prismaC.cartItem.create({
    data: {
      cartId: cart.id,
      productType: option.productType,
      optionKey,
      quantity: payload.quantity,
      unitPrice: option.unitPrice,
      ...(payload.customerInputs !== undefined
        ? { customerInputs: payload.customerInputs }
        : {}),
      ...(option.productType === DigitalProductType.GIFT_CARD
        ? {
            giftCardProductId: payload.productId,
            giftCardDenominationId: payload.giftCardDenominationId,
          }
        : option.productType === DigitalProductType.GAME_TOP_UP
          ? {
              gameTopUpProductId: payload.productId,
              gameTopUpPackageId: payload.gameTopUpPackageId,
            }
          : {
              subscriptionProductId: payload.productId,
              subscriptionPlanId: payload.subscriptionPlanId,
            }),
    },
    include: cartItemInclude,
  });
};

const findCartItem = async (payload: CartItemPayload) => {
  const productType = getProductType(payload);
  const cart = await prismaC.cart.findUnique({ where: { userId: payload.userId } });
  if (!cart) throw new ApiAppError(404, "Cart not found");

  const item = await prismaC.cartItem.findUnique({
    where: {
      cartId_productType_optionKey: {
        cartId: cart.id,
        productType,
        optionKey: getOptionKey(payload),
      },
    },
    include: cartItemInclude,
  });

  if (!item || !itemMatchesProduct(item, productType, payload.productId)) {
    throw new ApiAppError(404, "Cart item not found");
  }

  return item;
};

const updateCartItem = async (
  payload: CartItemPayload & { quantity: number },
) => {
  if (!Number.isInteger(payload.quantity) || payload.quantity < 0) {
    throw new ApiAppError(400, "Quantity must be a non-negative integer");
  }

  const item = await findCartItem(payload);
  if (payload.quantity === 0) {
    return prismaC.cartItem.delete({ where: { id: item.id } });
  }

  const option = await resolveProductOption(payload);
  if (option.stockQuantity !== null && option.stockQuantity < payload.quantity) {
    throw new ApiAppError(400, "Insufficient product stock");
  }

  return prismaC.cartItem.update({
    where: { id: item.id },
    data: { quantity: payload.quantity, unitPrice: option.unitPrice },
    include: cartItemInclude,
  });
};

const removeFromCart = async (payload: CartItemPayload) => {
  const item = await findCartItem(payload);
  return prismaC.cartItem.delete({ where: { id: item.id } });
};

const getCart = async (userId: string) => getOrCreateCart(userId);

const clearCart = async (userId: string) => {
  const cart = await getOrCreateCart(userId);
  await prismaC.cartItem.deleteMany({ where: { cartId: cart.id } });
  return { message: "Cart cleared successfully" };
};

export const cartServices = {
  addToCart,
  updateCartItem,
  removeFromCart,
  getCart,
  clearCart,
};
