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
import { adminRouter } from "../../modules/admin/admin.route";
import { paymentRouter } from "../../modules/payment/routes/payment.route";
import { giftCardAdminRouter } from "../../modules/gift-card/gift-card-admin.route";
import { giftCardCartRouter } from "../../modules/gift-card/gift-card-cart.route";
import { giftCardOrderRouter } from "../../modules/gift-card/gift-card-order.route";
import { gameTopUpAdminRouter } from "../../modules/game-top-up/game-top-up-admin.route";
import { gameTopUpOrderRouter } from "../../modules/game-top-up/game-top-up-order.route";
import { giftCardCheckoutRouter } from "../../modules/gift-card/gift-card-checkout.route";

const router = Router();

const moduleRoutes: TModuleRoute[] = [
  {
    path: "/checkout",
    route: giftCardCheckoutRouter,
  },
  {
    path: "/admin",
    route: giftCardAdminRouter,
  },
  {
    path: "/admin",
    route: gameTopUpAdminRouter,
  },
  {
    path: "/game-topup-orders",
    route: gameTopUpOrderRouter,
  },
  {
    path: "/game-topup/orders",
    route: gameTopUpOrderRouter,
  },
  {
    path: "/me/gift-card-orders",
    route: giftCardOrderRouter,
  },
  {
    path: "/orders",
    route: giftCardOrderRouter,
  },
  {
    path: "/cart",
    route: giftCardCartRouter,
  },
  {
    path: "/user",
    route: userRouter,
  },
  {
    path: "/admins",
    route: adminRouter,
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
    path: "/games",
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
  {
    path: "/payments",
    route: paymentRouter,
  },
];
moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
