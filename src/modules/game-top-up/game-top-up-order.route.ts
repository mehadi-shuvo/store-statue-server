import { Router } from "express";
import { authenticateUser } from "../../middlewares/auth.middleware";
import { authenticatedUserRateLimiter } from "../../middlewares/rate-limit.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { gameTopUpOrderController } from "./game-top-up-order.controller";
import { createTopUpOrderSchema, customerOrderQuerySchema, orderIdParamsSchema } from "./game-top-up.validation";

const router = Router();
router.use(authenticateUser, authenticatedUserRateLimiter);
router.post("/", validateRequest({ body: createTopUpOrderSchema }), gameTopUpOrderController.create);
router.get("/", validateRequest({ query: customerOrderQuerySchema }), gameTopUpOrderController.list);
router.get("/:orderId", validateRequest({ params: orderIdParamsSchema }), gameTopUpOrderController.get);
router.post("/:orderId/cancel", validateRequest({ params: orderIdParamsSchema }), gameTopUpOrderController.cancel);

export const gameTopUpOrderRouter = router;
