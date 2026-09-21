import { Router } from "express";
import { authenticateUser } from "../../../middlewares/auth.middleware";
import { validateRequest } from "../../../middlewares/validate.middleware";
import { paymentController } from "../controllers/payment.controller";
import { createPaymentSchema, executePaymentSchema, paymentParamsSchema, aamarpayCallbackSchema, aamarpayCallbackQuerySchema } from "../validators/payment.validation";
import { paymentRateLimiter } from "../../../middlewares/rate-limit.middleware";

const router = Router();
for (const path of ["/aamarpay/success", "/aamarpay/fail", "/aamarpay/cancel"]) {
  router.post(path, validateRequest({ body: aamarpayCallbackSchema, query: aamarpayCallbackQuerySchema }), paymentController.aamarpayCallback);
}
router.get("/aamarpay/cancel", validateRequest({ query: aamarpayCallbackQuerySchema }), paymentController.aamarpayCallback);
router.post(["/initiate", "/aamarpay/initiate", "/create"], authenticateUser, paymentRateLimiter, validateRequest({ body: createPaymentSchema }), paymentController.createPayment);
router.post(["/verify", "/execute"], authenticateUser, paymentRateLimiter, validateRequest({ body: executePaymentSchema }), paymentController.executePayment);
router.get("/status/:paymentId", authenticateUser, validateRequest({ params: paymentParamsSchema }), paymentController.getPaymentStatus);
export const paymentRouter = router;
