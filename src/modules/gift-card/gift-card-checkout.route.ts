import { Router } from "express";
import { authenticateUser } from "../../middlewares/auth.middleware";
import { authenticatedUserRateLimiter } from "../../middlewares/rate-limit.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { giftCardCommerceController } from "./gift-card-commerce.controller";
import { buyNowSchema } from "./gift-card.validation";

const router = Router();

router.post(
  "/buy-now",
  authenticateUser,
  authenticatedUserRateLimiter,
  validateRequest({ body: buyNowSchema }),
  giftCardCommerceController.buyNow,
);

export const giftCardCheckoutRouter = router;
