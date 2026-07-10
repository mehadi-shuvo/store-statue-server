import { Router } from "express";
import { authenticateUser } from "../../middlewares/auth.middleware";
import { reviewControllers } from "./review.controller";

const router = Router();

router.get("/product/:productId", reviewControllers.getProductReviews);
router.post("/", authenticateUser, reviewControllers.createReview);
router.patch("/:id", authenticateUser, reviewControllers.updateReview);
router.delete("/:id", authenticateUser, reviewControllers.deleteReview);

export const reviewRouter = router;
