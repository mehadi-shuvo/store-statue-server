import { Router } from "express";
import { authenticateUser } from "../../middlewares/auth.middleware";
import { cartControllers } from "./cart.controller";

const router = Router();

router.use(authenticateUser);

router.get("/", cartControllers.getCart);
router.get("/:userId", cartControllers.getCart);
router.post("/add", cartControllers.addToCart);
router.patch("/update", cartControllers.updateCartItem);
router.delete("/remove", cartControllers.removeFromCart);
router.delete("/clear", cartControllers.clearCart);
router.delete("/clear/:userId", cartControllers.clearCart);

export const cartRouter = router;
