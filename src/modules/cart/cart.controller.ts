import type { Request } from "express";
import catchAsync from "../../utils/catchAsync";
import { ApiAppError } from "../../utils/apiAppError";
import { cartServices } from "./cart.service";

const getAuthenticatedUserId = (req: Request) => {
  if (!req.authUser?.id) {
    throw new ApiAppError(401, "Authentication token is required");
  }

  return req.authUser.id;
};

const addToCart = catchAsync(async (req, res) => {
  const result = await cartServices.addToCart({
    ...req.body,
    userId: getAuthenticatedUserId(req),
  });

  res.status(200).json({
    success: true,
    message: "Product added to cart",
    data: result,
  });
});

const updateCartItem = catchAsync(async (req, res) => {
  const result = await cartServices.updateCartItem({
    ...req.body,
    userId: getAuthenticatedUserId(req),
  });

  res.status(200).json({
    success: true,
    message: "Cart item updated",
    data: result,
  });
});

const removeFromCart = catchAsync(async (req, res) => {
  const result = await cartServices.removeFromCart({
    ...req.body,
    userId: getAuthenticatedUserId(req),
  });

  res.status(200).json({
    success: true,
    message: "Item removed from cart",
    data: result,
  });
});

const getCart = catchAsync(async (req, res) => {
  const result = await cartServices.getCart(getAuthenticatedUserId(req));

  res.status(200).json({
    success: true,
    message: "Cart fetched successfully",
    data: result,
  });
});

const clearCart = catchAsync(async (req, res) => {
  const result = await cartServices.clearCart(getAuthenticatedUserId(req));

  res.status(200).json({
    success: true,
    message: "Cart cleared successfully",
    data: result,
  });
});

export const cartControllers = {
  addToCart,
  updateCartItem,
  removeFromCart,
  getCart,
  clearCart,
};
