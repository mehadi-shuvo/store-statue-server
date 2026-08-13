import { Router } from "express";
import { authenticateUser } from "../../../middlewares/auth.middleware";
import { validateRequest } from "../../../middlewares/validate.middleware";
import { paymentController } from "../controllers/payment.controller";
import {
  createPaymentSchema,
  executePaymentSchema,
  paymentParamsSchema,
  paymentScenarioQuerySchema,
} from "../validators/payment.validation";

const router = Router();

router.post(
  "/create",
  authenticateUser,
  validateRequest({ body: createPaymentSchema }),
  paymentController.createPayment,
);

router.post(
  "/execute",
  authenticateUser,
  validateRequest({ body: executePaymentSchema, query: paymentScenarioQuerySchema }),
  paymentController.executePayment,
);

router.get(
  "/status/:paymentId",
  authenticateUser,
  validateRequest({ params: paymentParamsSchema }),
  paymentController.getPaymentStatus,
);

export const paymentRouter = router;
