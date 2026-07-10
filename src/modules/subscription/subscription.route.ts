import { Router } from "express";
import { authenticateUser, requireAdmin } from "../../middlewares/auth.middleware";
import { subscriptionControllers } from "./subscription.controller";

const router = Router();

router.get("/", subscriptionControllers.getSubscriptions);
router.get("/:id", subscriptionControllers.getSubscriptionById);
router.post("/", authenticateUser, requireAdmin, subscriptionControllers.createSubscription);
router.patch(
  "/:id",
  authenticateUser,
  requireAdmin,
  subscriptionControllers.updateSubscription,
);
router.delete(
  "/:id",
  authenticateUser,
  requireAdmin,
  subscriptionControllers.deleteSubscription,
);

export const subscriptionRouter = router;
