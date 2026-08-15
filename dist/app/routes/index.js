"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_route_1 = require("../../modules/users/user.route");
const product_route_1 = require("../../modules/products/product.route");
const category_route_1 = require("../../modules/category/category.route");
const cart_route_1 = require("../../modules/cart/cart.route");
const game_top_up_route_1 = require("../../modules/game-top-up/game-top-up.route");
const gift_card_route_1 = require("../../modules/gift-card/gift-card.route");
const review_route_1 = require("../../modules/review/review.route");
const subscription_route_1 = require("../../modules/subscription/subscription.route");
const admin_route_1 = require("../../modules/admin/admin.route");
const payment_route_1 = require("../../modules/payment/routes/payment.route");
const gift_card_admin_route_1 = require("../../modules/gift-card/gift-card-admin.route");
const gift_card_cart_route_1 = require("../../modules/gift-card/gift-card-cart.route");
const gift_card_order_route_1 = require("../../modules/gift-card/gift-card-order.route");
const router = (0, express_1.Router)();
const moduleRoutes = [
    {
        path: "/admin",
        route: gift_card_admin_route_1.giftCardAdminRouter,
    },
    {
        path: "/me/gift-card-orders",
        route: gift_card_order_route_1.giftCardOrderRouter,
    },
    {
        path: "/cart",
        route: gift_card_cart_route_1.giftCardCartRouter,
    },
    {
        path: "/user",
        route: user_route_1.userRouter,
    },
    {
        path: "/admins",
        route: admin_route_1.adminRouter,
    },
    {
        path: "/products",
        route: product_route_1.productRouter,
    },
    {
        path: "/gift-cards",
        route: gift_card_route_1.giftCardRouter,
    },
    {
        path: "/top-ups",
        route: game_top_up_route_1.gameTopUpRouter,
    },
    {
        path: "/subscriptions",
        route: subscription_route_1.subscriptionRouter,
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
    {
        path: "/payments",
        route: payment_route_1.paymentRouter,
    },
];
moduleRoutes.forEach((route) => router.use(route.path, route.route));
exports.default = router;
