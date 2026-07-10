import { Router } from "express";
import { TModuleRoute } from "../types/types";
import { userRouter } from "../../modules/users/user.route";
import { productRouter } from "../../modules/products/product.route";
import { categoryRouter } from "../../modules/category/category.route";
import { cartRouter } from "../../modules/cart/cart.route";
import { gameTopUpRouter } from "../../modules/game-top-up/game-top-up.route";
import { giftCardRouter } from "../../modules/gift-card/gift-card.route";
import { reviewRouter } from "../../modules/review/review.route";
import { subscriptionRouter } from "../../modules/subscription/subscription.route";

const router = Router();

const moduleRoutes: TModuleRoute[] = [
  {
    path: "/user",
    route: userRouter,
  },
  {
    path: "/products",
    route: productRouter,
  },
  {
    path: "/gift-cards",
    route: giftCardRouter,
  },
  {
    path: "/top-ups",
    route: gameTopUpRouter,
  },
  {
    path: "/subscriptions",
    route: subscriptionRouter,
  },
  {
    path: "/categories",
    route: categoryRouter,
  },
  {
    path: "/user-cart",
    route: cartRouter,
  },
  {
    path: "/review",
    route: reviewRouter,
  },
];
moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
