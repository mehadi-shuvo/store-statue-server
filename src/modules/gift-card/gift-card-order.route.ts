import { Router } from "express";
import { authenticateUser } from "../../middlewares/auth.middleware";
import { authenticatedUserRateLimiter } from "../../middlewares/rate-limit.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { giftCardCommerceController } from "./gift-card-commerce.controller";
import { giftCardOrderQuerySchema, orderIdParamsSchema } from "./gift-card.validation";

const router = Router();
router.use(authenticateUser, authenticatedUserRateLimiter);
router.get("/", validateRequest({ query: giftCardOrderQuerySchema }), giftCardCommerceController.listOrders);
router.get("/:orderId", validateRequest({ params: orderIdParamsSchema }), giftCardCommerceController.getOrder);

export const giftCardOrderRouter = router;
