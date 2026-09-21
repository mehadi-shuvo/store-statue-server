import { Router } from "express";
import { validateRequest } from "../../middlewares/validate.middleware";
import { gameTopUpControllers } from "./game-top-up.controller";
import { gameIdParamsSchema, publicGameQuerySchema, slugParamsSchema } from "./game-top-up.validation";

const router = Router();
router.get("/", validateRequest({ query: publicGameQuerySchema }), gameTopUpControllers.listGames);
router.get("/:gameId/packages", validateRequest({ params: gameIdParamsSchema }), gameTopUpControllers.listPackages);
router.get("/:gameId/account-fields", validateRequest({ params: gameIdParamsSchema }), gameTopUpControllers.listAccountFields);
router.get("/:slug", validateRequest({ params: slugParamsSchema }), gameTopUpControllers.getGame);

export const gameTopUpRouter = router;
