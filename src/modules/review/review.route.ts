import { Router } from "express";
import { reviewControllers } from "./review.controller";

const router = Router();

router.get("/product/:productId", reviewControllers.getProductReviews);
router.post("/", reviewControllers.createReview);
router.patch("/:id", reviewControllers.updateReview);
router.delete("/:id", reviewControllers.deleteReview);

export const reviewRouter = router;
