import { ApiAppError } from "../../utils/apiAppError";
import { prismaC } from "../../utils/prisma-client";

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
  quantity: number;
}) => {
  const { userId, productId, quantity } = payload;

  if (quantity <= 0) {
    throw new ApiAppError(400, "Quantity must be greater than 0");
  }

  const product = await prismaC.product.findUnique({
    where: { id: productId },
  });

  if (!product || !product.isActive) {
    throw new ApiAppError(404, "Product not found");
  }

  if (product.stockQuantity < quantity) {
    throw new ApiAppError(400, "Insufficient product stock");
  }

  const cart = await getOrCreateCart(userId);

  const existingItem = await prismaC.cartItem.findUnique({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId,
      },
    },
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;

    if (product.stockQuantity < newQuantity) {
      throw new ApiAppError(400, "Stock limit exceeded");
    }

    return prismaC.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
    });
  }

  return prismaC.cartItem.create({
    data: {
      cartId: cart.id,
      productId,
      quantity,
    },
  });
};

/**
 * Update Cart Item Quantity
 */
const updateCartItem = async (payload: {
  userId: string;
  productId: string;
  quantity: number;
}) => {
  const { userId, productId, quantity } = payload;

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
      cartId_productId: {
        cartId: cart.id,
        productId,
      },
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

  const product = await prismaC.product.findUnique({
    where: { id: productId },
  });

  if (!product || product.stockQuantity < quantity) {
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
}) => {
  const { userId, productId } = payload;

  const cart = await prismaC.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    throw new ApiAppError(404, "Cart not found");
  }

  const cartItem = await prismaC.cartItem.findUnique({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId,
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
