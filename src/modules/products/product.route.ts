import { Router } from "express";
import { productControllers } from "./product.controller";

const router = Router();

router.post("/", productControllers.addProduct);
router.patch("/:id", productControllers.updateProduct);
router.delete("/:id", productControllers.deleteProduct);
router.get("/", productControllers.getProducts);
router.get("/:id", productControllers.getSingleProduct);

export const productRouter = router;
