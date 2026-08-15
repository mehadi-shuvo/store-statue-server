import { Router } from "express";
import { authenticateUser } from "../../middlewares/auth.middleware";
import { authenticatedUserRateLimiter } from "../../middlewares/rate-limit.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { giftCardCommerceController } from "./gift-card-commerce.controller";
import {
  cartGiftCardItemSchema,
  cartItemIdParamsSchema,
  deliveryEmailSchema,
  updateCartGiftCardItemSchema,
} from "./gift-card.validation";

const router = Router();
router.use(authenticateUser, authenticatedUserRateLimiter);

router.get("/", giftCardCommerceController.getCart);
router.post("/items", validateRequest({ body: cartGiftCardItemSchema }), giftCardCommerceController.addCartItem);
router.patch("/items/:cartItemId", validateRequest({ params: cartItemIdParamsSchema, body: updateCartGiftCardItemSchema }), giftCardCommerceController.updateCartItem);
router.delete("/items/:cartItemId", validateRequest({ params: cartItemIdParamsSchema }), giftCardCommerceController.removeCartItem);
router.delete("/", giftCardCommerceController.clearCart);
router.post("/checkout", validateRequest({ body: deliveryEmailSchema }), giftCardCommerceController.checkoutCart);

export const giftCardCartRouter = router;
