import { Router } from "express";
import { authenticateUser, requireAdmin } from "../../middlewares/auth.middleware";
import { gameTopUpControllers } from "./game-top-up.controller";

const router = Router();

router.get("/", gameTopUpControllers.getTopUps);
router.get("/:id", gameTopUpControllers.getTopUpById);
router.post("/", authenticateUser, requireAdmin, gameTopUpControllers.createTopUp);
router.patch("/:id", authenticateUser, requireAdmin, gameTopUpControllers.updateTopUp);
router.delete("/:id", authenticateUser, requireAdmin, gameTopUpControllers.deleteTopUp);

export const gameTopUpRouter = router;
