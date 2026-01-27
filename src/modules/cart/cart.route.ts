import { Router } from "express";
import { cartControllers } from "./cart.controller";

const router = Router();

router.get("/:userId", cartControllers.getCart);
router.post("/add", cartControllers.addToCart);
router.patch("/update", cartControllers.updateCartItem);
router.delete("/remove", cartControllers.removeFromCart);
router.delete("/clear/:userId", cartControllers.clearCart);

export const cartRouter = router;
