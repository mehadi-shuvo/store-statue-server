"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_route_1 = require("../../modules/users/user.route");
const product_route_1 = require("../../modules/products/product.route");
const category_route_1 = require("../../modules/category/category.route");
const cart_route_1 = require("../../modules/cart/cart.route");
const review_route_1 = require("../../modules/review/review.route");
const router = (0, express_1.Router)();
const moduleRoutes = [
    {
        path: "/user",
        route: user_route_1.userRouter,
    },
    {
        path: "/products",
        route: product_route_1.productRouter,
    },
    {
        path: "/categories",
        route: category_route_1.categoryRouter,
    },
    {
        path: "/user-cart",
        route: cart_route_1.cartRouter,
    },
    {
        path: "/review",
        route: review_route_1.reviewRouter,
    },
];
moduleRoutes.forEach((route) => router.use(route.path, route.route));
exports.default = router;
