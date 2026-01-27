import { Router } from "express";
import { TModuleRoute } from "../types/types";
import { userRouter } from "../../modules/users/user.route";
import { productRouter } from "../../modules/products/product.route";
import { categoryRouter } from "../../modules/category/category.route";
import { cartRouter } from "../../modules/cart/cart.route";

const router = Router();

const moduleRoutes: TModuleRoute[] = [
  {
    path: "/user",
    route: userRouter,
  },
  {
    path: "/product",
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
];
moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
