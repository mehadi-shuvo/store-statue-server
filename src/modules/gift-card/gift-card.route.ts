import { Router } from "express";
import { authenticateUser, requireAdmin } from "../../middlewares/auth.middleware";
import { giftCardControllers } from "./gift-card.controller";
import { validateRequest } from "../../middlewares/validate.middleware";
import { giftCardCommerceController } from "./gift-card-commerce.controller";
import { instantBuySchema, publicGiftCardQuerySchema } from "./gift-card.validation";

const router = Router();

router.get("/", validateRequest({ query: publicGiftCardQuerySchema }), giftCardControllers.getGiftCards);
router.post(
  "/instant-buy",
  authenticateUser,
  validateRequest({ body: instantBuySchema }),
  giftCardCommerceController.instantBuy,
);
router.get("/:id", giftCardControllers.getGiftCardById);
router.post("/", authenticateUser, requireAdmin, giftCardControllers.createGiftCard);
router.patch("/:id", authenticateUser, requireAdmin, giftCardControllers.updateGiftCard);
router.delete("/:id", authenticateUser, requireAdmin, giftCardControllers.deleteGiftCard);

export const giftCardRouter = router;
