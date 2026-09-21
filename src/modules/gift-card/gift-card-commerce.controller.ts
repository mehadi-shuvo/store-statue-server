import catchAsync from "../../utils/catchAsync";
import { cartServices } from "../cart/cart.service";
import { giftCardOrderService } from "./gift-card-order.service";
import { giftCardPurchaseService } from "./gift-card-purchase.service";

const checkoutKey = (value: string | string[] | undefined) => {
  const key = Array.isArray(value) ? value[0] : value;
  return key?.trim().slice(0, 128) || undefined;
};

const buyNow = catchAsync(async (req, res) => {
  const data = await giftCardPurchaseService.buyNow(
    req.authUser!.id,
    req.body,
    checkoutKey(req.headers["idempotency-key"]),
  );
  res.status(201).json({ success: true, message: "Gift-card checkout created", data });
});

const instantBuy = catchAsync(async (req, res) => {
  const data = await giftCardPurchaseService.instantBuy(req.authUser!.id, req.body, checkoutKey(req.headers["idempotency-key"]));
  res.status(201).json({ success: true, message: "Gift-card checkout created", data });
});

const addCartItem = catchAsync(async (req, res) => {
  const data = await cartServices.addGiftCardItem(req.authUser!.id, req.body);
  res.status(201).json({ success: true, message: "Gift card added to cart", data });
});

const updateCartItem = catchAsync(async (req, res) => {
  const data = await cartServices.updateGiftCardItem(req.authUser!.id, req.params.cartItemId, req.body.quantity);
  res.status(200).json({ success: true, message: "Cart item updated", data });
});

const removeCartItem = catchAsync(async (req, res) => {
  const data = await cartServices.removeGiftCardItem(req.authUser!.id, req.params.cartItemId);
  res.status(200).json({ success: true, message: "Cart item removed", data });
});

const getCart = catchAsync(async (req, res) => {
  const data = await cartServices.getCart(req.authUser!.id);
  res.status(200).json({ success: true, message: "Cart fetched successfully", data });
});

const clearCart = catchAsync(async (req, res) => {
  const data = await cartServices.clearCart(req.authUser!.id);
  res.status(200).json({ success: true, message: "Cart cleared successfully", data });
});

const checkoutCart = catchAsync(async (req, res) => {
  const data = await giftCardPurchaseService.checkoutCart(req.authUser!.id, req.body, checkoutKey(req.headers["idempotency-key"]));
  res.status(201).json({ success: true, message: "Gift-card checkout created", data });
});

const listOrders = catchAsync(async (req, res) => {
  const data = await giftCardOrderService.listForCustomer(req.authUser!.id, req.query as never);
  res.status(200).json({ success: true, message: "Gift card orders fetched successfully", data });
});

const getOrder = catchAsync(async (req, res) => {
  const data = await giftCardOrderService.getForCustomer(req.authUser!.id, req.params.orderId);
  res.status(200).json({ success: true, message: "Gift card order fetched successfully", data });
});

const getDelivery = catchAsync(async (req, res) => {
  const data = await giftCardOrderService.getDeliveryForCustomer(req.authUser!.id, req.params.orderId);
  res.status(200).json({ success: true, message: "Gift-card delivery fetched successfully", data });
});

export const giftCardCommerceController = {
  instantBuy,
  buyNow,
  addCartItem,
  updateCartItem,
  removeCartItem,
  getCart,
  clearCart,
  checkoutCart,
  listOrders,
  getOrder,
  getDelivery,
};
