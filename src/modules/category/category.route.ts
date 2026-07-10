import { Router } from "express";
import {
  authenticateUser,
  optionalAuthenticateUser,
  requireAdmin,
} from "../../middlewares/auth.middleware";
import { categoryControllers } from "./category.controller";

const router = Router();

router.get("/", optionalAuthenticateUser, categoryControllers.getCategories);
router.post("/", authenticateUser, requireAdmin, categoryControllers.addCategory);
router.post(
  "/bulk",
  authenticateUser,
  requireAdmin,
  categoryControllers.bulkAddCategories,
);
router.patch("/:id", authenticateUser, requireAdmin, categoryControllers.updateCategory);
router.delete("/:id", authenticateUser, requireAdmin, categoryControllers.deleteCategory);

export const categoryRouter = router;
