import { Router } from "express";
import { authenticateUser, requireAdmin } from "../../middlewares/auth.middleware";
import { adminRateLimiter } from "../../middlewares/rate-limit.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { gameTopUpAdminController } from "./game-top-up-admin.controller";
import {
  accountFieldIdParamsSchema, adminGameQuerySchema, adminOrderQuerySchema,
  completeOrderSchema, createAccountFieldSchema, createGameSchema, createPackageSchema,
  failOrderSchema, gameIdParamsSchema, orderIdParamsSchema, packageIdParamsSchema,
  updateAccountFieldSchema, updateGameSchema, updatePackageSchema,
} from "./game-top-up.validation";

const router = Router();
router.use(authenticateUser, adminRateLimiter, requireAdmin);

router.get("/game-topup-orders", validateRequest({ query: adminOrderQuerySchema }), gameTopUpAdminController.listOrders);
router.get("/game-topup-orders/:orderId", validateRequest({ params: orderIdParamsSchema }), gameTopUpAdminController.getOrder);
router.post("/game-topup-orders/:orderId/start", validateRequest({ params: orderIdParamsSchema }), gameTopUpAdminController.startOrder);
router.post("/game-topup-orders/:orderId/complete", validateRequest({ params: orderIdParamsSchema, body: completeOrderSchema }), gameTopUpAdminController.completeOrder);
router.post("/game-topup-orders/:orderId/fail", validateRequest({ params: orderIdParamsSchema, body: failOrderSchema }), gameTopUpAdminController.failOrder);

router.post("/games", validateRequest({ body: createGameSchema }), gameTopUpAdminController.createGame);
router.get("/games", validateRequest({ query: adminGameQuerySchema }), gameTopUpAdminController.listGames);
router.get("/games/:gameId", validateRequest({ params: gameIdParamsSchema }), gameTopUpAdminController.getGame);
router.patch("/games/:gameId", validateRequest({ params: gameIdParamsSchema, body: updateGameSchema }), gameTopUpAdminController.updateGame);
router.delete("/games/:gameId", validateRequest({ params: gameIdParamsSchema }), gameTopUpAdminController.archiveGame);

router.post("/games/:gameId/packages", validateRequest({ params: gameIdParamsSchema, body: createPackageSchema }), gameTopUpAdminController.createPackage);
router.get("/games/:gameId/packages", validateRequest({ params: gameIdParamsSchema }), gameTopUpAdminController.listPackages);
router.get("/game-topup-packages/:packageId", validateRequest({ params: packageIdParamsSchema }), gameTopUpAdminController.getPackage);
router.patch("/game-topup-packages/:packageId", validateRequest({ params: packageIdParamsSchema, body: updatePackageSchema }), gameTopUpAdminController.updatePackage);
router.delete("/game-topup-packages/:packageId", validateRequest({ params: packageIdParamsSchema }), gameTopUpAdminController.deactivatePackage);

router.post("/games/:gameId/account-fields", validateRequest({ params: gameIdParamsSchema, body: createAccountFieldSchema }), gameTopUpAdminController.createAccountField);
router.get("/games/:gameId/account-fields", validateRequest({ params: gameIdParamsSchema }), gameTopUpAdminController.listAccountFields);
router.patch("/game-account-fields/:fieldId", validateRequest({ params: accountFieldIdParamsSchema, body: updateAccountFieldSchema }), gameTopUpAdminController.updateAccountField);
router.delete("/game-account-fields/:fieldId", validateRequest({ params: accountFieldIdParamsSchema }), gameTopUpAdminController.deactivateAccountField);

export const gameTopUpAdminRouter = router;
