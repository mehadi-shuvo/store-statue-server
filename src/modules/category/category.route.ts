import { Router } from "express";
import { categoryControllers } from "./category.controller";

const router = Router();

router.get("/", categoryControllers.getCategories);
router.post("/", categoryControllers.addCategory);
router.post("/bulk", categoryControllers.bulkAddCategories);
router.patch("/:id", categoryControllers.updateCategory);
router.delete("/:id", categoryControllers.deleteCategory);

export const categoryRouter = router;
