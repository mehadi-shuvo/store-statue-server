import { Router } from "express";
import { authenticateUser, requireAdmin } from "../../middlewares/auth.middleware";
import { productImageUpload } from "../../middlewares/upload.middleware";
import { productControllers } from "./product.controller";

const router = Router();

router.get("/", productControllers.getProducts);
router.get("/:id", productControllers.getSingleProduct);
router.post(
  "/",
  authenticateUser,
  requireAdmin,
  productImageUpload,
  productControllers.addProduct,
);
router.post(
  "/multiple",
  authenticateUser,
  requireAdmin,
  productControllers.bulkUploadProductsController,
);
router.patch(
  "/:id",
  authenticateUser,
  requireAdmin,
  productImageUpload,
  productControllers.updateProduct,
);
router.delete("/:id", authenticateUser, requireAdmin, productControllers.deleteProduct);
export const productRouter = router;
