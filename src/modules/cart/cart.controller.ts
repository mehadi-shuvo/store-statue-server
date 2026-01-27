import catchAsync from "../../utils/catchAsync";
import { cartServices } from "./cart.service";

const addToCart = catchAsync(async (req, res) => {
  const result = await cartServices.addToCart(req.body);

  res.status(200).json({
    success: true,
    message: "Product added to cart",
    data: result,
  });
});

const updateCartItem = catchAsync(async (req, res) => {
  const result = await cartServices.updateCartItem(req.body);

  res.status(200).json({
    success: true,
    message: "Cart item updated",
    data: result,
  });
});

const removeFromCart = catchAsync(async (req, res) => {
  const result = await cartServices.removeFromCart(req.body);

  res.status(200).json({
    success: true,
    message: "Item removed from cart",
    data: result,
  });
});

const getCart = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const result = await cartServices.getCart(userId);

  res.status(200).json({
    success: true,
    message: "Cart fetched successfully",
    data: result,
  });
});

const clearCart = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const result = await cartServices.clearCart(userId);

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
