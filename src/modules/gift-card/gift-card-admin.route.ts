import { Router } from "express";
import { authenticateUser, requireAdmin } from "../../middlewares/auth.middleware";
import { adminRateLimiter } from "../../middlewares/rate-limit.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { giftCardAdminController } from "./gift-card-admin.controller";
import {
  adminGiftCardOrderQuerySchema,
  adminGiftCardQuerySchema,
  bulkInventoryCodeSchema,
  codeIdParamsSchema,
  createDenominationSchema,
  createGiftCardSchema,
  denominationIdParamsSchema,
  giftCardIdParamsSchema,
  inventoryCodeSchema,
  inventoryQuerySchema,
  orderIdParamsSchema,
  updateDenominationSchema,
  updateGiftCardSchema,
  updateInventoryCodeSchema,
} from "./gift-card.validation";

const router = Router();
router.use(authenticateUser, adminRateLimiter, requireAdmin);

router.get("/gift-card-inventory/summary", giftCardAdminController.inventorySummary);
router.get("/gift-card-orders", validateRequest({ query: adminGiftCardOrderQuerySchema }), giftCardAdminController.listOrders);
router.get("/gift-card-orders/:orderId", validateRequest({ params: orderIdParamsSchema }), giftCardAdminController.getOrder);

router.post("/gift-cards", validateRequest({ body: createGiftCardSchema }), giftCardAdminController.createProduct);
router.get("/gift-cards", validateRequest({ query: adminGiftCardQuerySchema }), giftCardAdminController.listProducts);
router.get("/gift-cards/:giftCardId", validateRequest({ params: giftCardIdParamsSchema }), giftCardAdminController.getProduct);
router.patch("/gift-cards/:giftCardId", validateRequest({ params: giftCardIdParamsSchema, body: updateGiftCardSchema }), giftCardAdminController.updateProduct);
router.delete("/gift-cards/:giftCardId", validateRequest({ params: giftCardIdParamsSchema }), giftCardAdminController.archiveProduct);

router.post("/gift-cards/:giftCardId/denominations", validateRequest({ params: giftCardIdParamsSchema, body: createDenominationSchema }), giftCardAdminController.createDenomination);
router.get("/gift-cards/:giftCardId/denominations", validateRequest({ params: giftCardIdParamsSchema }), giftCardAdminController.listDenominations);
router.patch("/gift-card-denominations/:denominationId", validateRequest({ params: denominationIdParamsSchema, body: updateDenominationSchema }), giftCardAdminController.updateDenomination);
router.delete("/gift-card-denominations/:denominationId", validateRequest({ params: denominationIdParamsSchema }), giftCardAdminController.deleteDenomination);

router.post("/gift-card-denominations/:denominationId/codes/bulk", validateRequest({ params: denominationIdParamsSchema, body: bulkInventoryCodeSchema }), giftCardAdminController.addCodesBulk);
router.post("/gift-card-denominations/:denominationId/codes", validateRequest({ params: denominationIdParamsSchema, body: inventoryCodeSchema }), giftCardAdminController.addCode);
router.get("/gift-card-denominations/:denominationId/codes", validateRequest({ params: denominationIdParamsSchema, query: inventoryQuerySchema }), giftCardAdminController.listCodes);
router.get("/gift-card-codes/:codeId", validateRequest({ params: codeIdParamsSchema }), giftCardAdminController.getCode);
router.patch("/gift-card-codes/:codeId", validateRequest({ params: codeIdParamsSchema, body: updateInventoryCodeSchema }), giftCardAdminController.updateCode);
router.delete("/gift-card-codes/:codeId", validateRequest({ params: codeIdParamsSchema }), giftCardAdminController.deleteCode);

export const giftCardAdminRouter = router;
