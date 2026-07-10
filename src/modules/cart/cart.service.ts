import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";
import { ProductType, type Prisma } from "../../generated/prisma/client";

/**
 * Get or Create Cart for User
 */
const getOrCreateCart = async (userId: string) => {
  let cart = await prismaC.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: true,
          giftCardDenomination: true,
          gameTopUpPackage: true,
          subscriptionPlan: true,
        },
      },
    },
  });

  if (!cart) {
    cart = await prismaC.cart.create({
      data: { userId },
      include: {
        items: {
          include: {
            product: true,
            giftCardDenomination: true,
            gameTopUpPackage: true,
            subscriptionPlan: true,
          },
        },
      },
    });
  }

  return cart;
};

/**
 * Add Item to Cart
 */
const addToCart = async (payload: {
  userId: string;
  productId: string;
  giftCardDenominationId?: string;
  gameTopUpPackageId?: string;
  subscriptionPlanId?: string;
  customerInputs?: Prisma.InputJsonValue;
  quantity: number;
}) => {
  const {
    userId,
    productId,
    giftCardDenominationId,
    gameTopUpPackageId,
    subscriptionPlanId,
    customerInputs,
    quantity,
  } = payload;
  const selectedOptionCount = [
    giftCardDenominationId,
    gameTopUpPackageId,
    subscriptionPlanId,
  ].filter(Boolean).length;

  if (selectedOptionCount > 1) {
    throw new ApiAppError(400, "Only one product option can be selected");
  }

  const optionKey = giftCardDenominationId
    ? `gift-card:${giftCardDenominationId}`
    : gameTopUpPackageId
      ? `game-top-up:${gameTopUpPackageId}`
      : subscriptionPlanId
        ? `subscription:${subscriptionPlanId}`
        : "default";

  if (quantity <= 0) {
    throw new ApiAppError(400, "Quantity must be greater than 0");
  }

  const product = await prismaC.product.findUnique({
    where: { id: productId },
  });

  if (!product || !product.isActive) {
    throw new ApiAppError(404, "Product not found");
  }

  if (product.type === ProductType.PHYSICAL && selectedOptionCount > 0) {
    throw new ApiAppError(400, "Physical products do not accept digital options");
  }

  if (product.type === ProductType.GIFT_CARD && !giftCardDenominationId) {
    throw new ApiAppError(400, "Gift card denomination is required");
  }

  if (product.type === ProductType.GAME_TOP_UP && !gameTopUpPackageId) {
    throw new ApiAppError(400, "Game top-up package is required");
  }

  if (product.type === ProductType.SUBSCRIPTION && !subscriptionPlanId) {
    throw new ApiAppError(400, "Subscription plan is required");
  }

  let unitPrice = product.price;
  let stockQuantity: number | null = product.stockQuantity;

  if (giftCardDenominationId) {
    const denomination = await prismaC.giftCardDenomination.findFirst({
      where: {
        id: giftCardDenominationId,
        isActive: true,
        giftCardProduct: { is: { productId } },
      },
    });

    if (!denomination) {
      throw new ApiAppError(404, "Gift card denomination not found");
    }

    unitPrice = denomination.bdtPrice;
    stockQuantity = denomination.stockQuantity;
  }

  if (gameTopUpPackageId) {
    const topUpPackage = await prismaC.gameTopUpPackage.findFirst({
      where: {
        id: gameTopUpPackageId,
        isActive: true,
        gameTopUpProduct: { is: { productId } },
      },
    });

    if (!topUpPackage) {
      throw new ApiAppError(404, "Game top-up package not found");
    }

    unitPrice = topUpPackage.price;
    stockQuantity = topUpPackage.stockQuantity;
  }

  if (subscriptionPlanId) {
    const subscriptionPlan = await prismaC.subscriptionPlan.findFirst({
      where: {
        id: subscriptionPlanId,
        isActive: true,
        subscriptionProduct: { is: { productId } },
      },
    });

    if (!subscriptionPlan) {
      throw new ApiAppError(404, "Subscription plan not found");
    }

    unitPrice = subscriptionPlan.price;
    stockQuantity = subscriptionPlan.stockQuantity;
  }

  if (stockQuantity !== null && stockQuantity < quantity) {
    throw new ApiAppError(400, "Insufficient product stock");
  }

  const cart = await getOrCreateCart(userId);

  const existingItem = await prismaC.cartItem.findUnique({
    where: {
      cartId_productId_optionKey: {
        cartId: cart.id,
        productId,
        optionKey,
      },
    },
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;

    if (stockQuantity !== null && stockQuantity < newQuantity) {
      throw new ApiAppError(400, "Stock limit exceeded");
    }

    return prismaC.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity, customerInputs },
    });
  }

  return prismaC.cartItem.create({
    data: {
      cartId: cart.id,
      productId,
      giftCardDenominationId,
      gameTopUpPackageId,
      subscriptionPlanId,
      optionKey,
      quantity,
      customerInputs,
      unitPrice,
    },
  });
};

/**
 * Update Cart Item Quantity
 */
const updateCartItem = async (payload: {
  userId: string;
  productId: string;
  giftCardDenominationId?: string;
  gameTopUpPackageId?: string;
  subscriptionPlanId?: string;
  quantity: number;
}) => {
  const {
    userId,
    productId,
    giftCardDenominationId,
    gameTopUpPackageId,
    subscriptionPlanId,
    quantity,
  } = payload;
  const optionKey = giftCardDenominationId
    ? `gift-card:${giftCardDenominationId}`
    : gameTopUpPackageId
      ? `game-top-up:${gameTopUpPackageId}`
      : subscriptionPlanId
        ? `subscription:${subscriptionPlanId}`
        : "default";

  if (quantity < 0) {
    throw new ApiAppError(400, "Quantity cannot be negative");
  }

  const cart = await prismaC.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    throw new ApiAppError(404, "Cart not found");
  }

  const cartItem = await prismaC.cartItem.findUnique({
    where: {
      cartId_productId_optionKey: {
        cartId: cart.id,
        productId,
        optionKey,
      },
    },
    include: {
      product: true,
      giftCardDenomination: true,
      gameTopUpPackage: true,
      subscriptionPlan: true,
    },
  });

  if (!cartItem) {
    throw new ApiAppError(404, "Cart item not found");
  }

  if (quantity === 0) {
    return prismaC.cartItem.delete({
      where: { id: cartItem.id },
    });
  }

  const stockQuantity = cartItem.giftCardDenomination
    ? cartItem.giftCardDenomination.stockQuantity
    : cartItem.gameTopUpPackage
      ? cartItem.gameTopUpPackage.stockQuantity
      : cartItem.subscriptionPlan
        ? cartItem.subscriptionPlan.stockQuantity
        : cartItem.product.stockQuantity;

  if (
    !cartItem.product.isActive ||
    (stockQuantity !== null && stockQuantity < quantity)
  ) {
    throw new ApiAppError(400, "Insufficient product stock");
  }

  return prismaC.cartItem.update({
    where: { id: cartItem.id },
    data: { quantity },
  });
};

/**
 * Remove Item from Cart
 */
const removeFromCart = async (payload: {
  userId: string;
  productId: string;
  giftCardDenominationId?: string;
  gameTopUpPackageId?: string;
  subscriptionPlanId?: string;
}) => {
  const {
    userId,
    productId,
    giftCardDenominationId,
    gameTopUpPackageId,
    subscriptionPlanId,
  } = payload;
  const optionKey = giftCardDenominationId
    ? `gift-card:${giftCardDenominationId}`
    : gameTopUpPackageId
      ? `game-top-up:${gameTopUpPackageId}`
      : subscriptionPlanId
        ? `subscription:${subscriptionPlanId}`
        : "default";

  const cart = await prismaC.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    throw new ApiAppError(404, "Cart not found");
  }

  const cartItem = await prismaC.cartItem.findUnique({
    where: {
      cartId_productId_optionKey: {
        cartId: cart.id,
        productId,
        optionKey,
      },
    },
  });

  if (!cartItem) {
    throw new ApiAppError(404, "Cart item not found");
  }

  return prismaC.cartItem.delete({
    where: { id: cartItem.id },
  });
};

/**
 * Get Cart Details
 */
const getCart = async (userId: string) => {
  return getOrCreateCart(userId);
};

/**
 * Clear Cart
 */
const clearCart = async (userId: string) => {
  const cart = await getOrCreateCart(userId);

  await prismaC.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  return { message: "Cart cleared successfully" };
};

export const cartServices = {
  addToCart,
  updateCartItem,
  removeFromCart,
  getCart,
  clearCart,
};
