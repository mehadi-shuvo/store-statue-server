import { Router } from "express";
import { categoryControllers } from "./category.controller";

const router = Router();

router.post("/", categoryControllers.addCategory);
router.patch("/:id", categoryControllers.updateCategory);
router.delete("/:id", categoryControllers.deleteCategory);

export const categoryRouter = router;
