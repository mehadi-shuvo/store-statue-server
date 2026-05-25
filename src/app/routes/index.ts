import { Router } from "express";
import { TModuleRoute } from "../types/types";
import { userRouter } from "../../modules/users/user.route";
import { productRouter } from "../../modules/products/product.route";
import { categoryRouter } from "../../modules/category/category.route";
import { cartRouter } from "../../modules/cart/cart.route";
import { reviewRouter } from "../../modules/review/review.route";

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
