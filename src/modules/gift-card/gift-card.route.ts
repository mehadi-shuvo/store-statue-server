import { Router } from "express";
import { authenticateUser, requireAdmin } from "../../middlewares/auth.middleware";
import { giftCardControllers } from "./gift-card.controller";

const router = Router();

router.get("/", giftCardControllers.getGiftCards);
router.get("/:id", giftCardControllers.getGiftCardById);
router.post("/", authenticateUser, requireAdmin, giftCardControllers.createGiftCard);
router.patch("/:id", authenticateUser, requireAdmin, giftCardControllers.updateGiftCard);
router.delete("/:id", authenticateUser, requireAdmin, giftCardControllers.deleteGiftCard);

export const giftCardRouter = router;
