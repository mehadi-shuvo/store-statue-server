import { Router } from "express";
import { authenticateUser } from "../../middlewares/auth.middleware";
import { authenticatedUserRateLimiter } from "../../middlewares/rate-limit.middleware";
import { reviewControllers } from "./review.controller";

const router = Router();

router.get("/product/:productId", reviewControllers.getProductReviews);
router.post("/", authenticateUser, authenticatedUserRateLimiter, reviewControllers.createReview);
router.patch("/:id", authenticateUser, authenticatedUserRateLimiter, reviewControllers.updateReview);
router.delete("/:id", authenticateUser, authenticatedUserRateLimiter, reviewControllers.deleteReview);

export const reviewRouter = router;
