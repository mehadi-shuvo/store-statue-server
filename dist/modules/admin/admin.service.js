"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("../../generated/prisma/client");
const apiAppError_1 = require("../../utils/apiAppError");
const env_config_1 = require("../../utils/env-config");
const prisma_client_1 = require("../../utils/prisma-client");
const adminProfileSelect = {
    id: true,
    email: true,
    name: true,
    phone: true,
    role: true,
    isDeleted: true,
    createdAt: true,
    updatedAt: true,
};
const adminRoles = [client_1.UserRole.ADMIN, client_1.UserRole.SUPER_ADMIN];
const digitalProductTypes = [
    client_1.DigitalProductType.GIFT_CARD,
    client_1.DigitalProductType.GAME_TOP_UP,
    client_1.DigitalProductType.SUBSCRIPTION,
];
const isPrismaKnownError = (error, code) => typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code;
const getActiveAdminById = async (adminId) => {
    const admin = await prisma_client_1.prismaC.user.findFirst({
        where: {
            id: adminId,
            role: { in: adminRoles },
            isActive: true,
            isDeleted: false,
        },
    });
    if (!admin) {
        throw new apiAppError_1.ApiAppError(404, "Admin profile not found");
    }
    return admin;
};
const createAuditLog = async (payload) => {
    await prisma_client_1.prismaC.auditLog.create({
        data: {
            actorId: payload.actorId,
            action: payload.action,
            entityType: payload.entityType,
            entityId: payload.entityId,
            metadata: payload.metadata,
        },
    });
};
const verifyActorPassword = async (actorId, currentPassword) => {
    const actor = await getActiveAdminById(actorId);
    const isPasswordMatched = await bcryptjs_1.default.compare(currentPassword, actor.password);
    if (!isPasswordMatched) {
        throw new apiAppError_1.ApiAppError(401, "Invalid current password");
    }
    return actor;
};
const createAdmin = async (actorId, payload) => {
    await verifyActorPassword(actorId, payload.currentPassword);
    const existingUser = await prisma_client_1.prismaC.user.findUnique({
        where: { email: payload.email },
    });
    if (existingUser) {
        throw new apiAppError_1.ApiAppError(409, "User with this email already exists");
    }
    const hashedPassword = await bcryptjs_1.default.hash(payload.password, env_config_1.ENV.BCRYPT_SALT);
    try {
        return await prisma_client_1.prismaC.user.create({
            data: {
                email: payload.email,
                name: payload.name,
                phone: payload.phone,
                password: hashedPassword,
                role: client_1.UserRole.ADMIN,
            },
            select: adminProfileSelect,
        });
    }
    catch (error) {
        if (isPrismaKnownError(error, "P2002")) {
            throw new apiAppError_1.ApiAppError(409, "User with this email already exists");
        }
        throw new apiAppError_1.ApiAppError(500, "Failed to create admin profile", error);
    }
};
const getAdmins = async (includeInactive = false) => {
    return prisma_client_1.prismaC.user.findMany({
        where: {
            role: { in: adminRoles },
            ...(includeInactive ? {} : { isDeleted: false }),
        },
        orderBy: { createdAt: "desc" },
        select: adminProfileSelect,
    });
};
const getAdminById = async (adminId) => {
    const admin = await prisma_client_1.prismaC.user.findFirst({
        where: {
            id: adminId,
            role: { in: adminRoles },
        },
        select: adminProfileSelect,
    });
    if (!admin) {
        throw new apiAppError_1.ApiAppError(404, "Admin profile not found");
    }
    return admin;
};
const getOwnProfile = async (adminId) => {
    await getActiveAdminById(adminId);
    return prisma_client_1.prismaC.user.findUnique({
        where: { id: adminId },
        select: adminProfileSelect,
    });
};
const updateOwnProfile = async (adminId, payload) => {
    await getActiveAdminById(adminId);
    return prisma_client_1.prismaC.user.update({
        where: { id: adminId },
        data: {
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
        },
        select: adminProfileSelect,
    });
};
const updateAdminById = async (actorId, adminId, payload) => {
    await verifyActorPassword(actorId, payload.currentPassword);
    const admin = await getActiveAdminById(adminId);
    if (admin.role === client_1.UserRole.SUPER_ADMIN) {
        throw new apiAppError_1.ApiAppError(403, "Super admin profiles can only be updated by themselves");
    }
    return prisma_client_1.prismaC.user.update({
        where: { id: adminId },
        data: {
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
        },
        select: adminProfileSelect,
    });
};
const changeOwnPassword = async (adminId, payload) => {
    const admin = await getActiveAdminById(adminId);
    const isPasswordMatched = await bcryptjs_1.default.compare(payload.currentPassword, admin.password);
    if (!isPasswordMatched) {
        throw new apiAppError_1.ApiAppError(401, "Invalid current password");
    }
    const hashedPassword = await bcryptjs_1.default.hash(payload.newPassword, env_config_1.ENV.BCRYPT_SALT);
    await prisma_client_1.prismaC.user.update({
        where: { id: adminId },
        data: { password: hashedPassword },
    });
    return { changed: true };
};
const deactivateAdmin = async (actorId, adminId) => {
    await getActiveAdminById(actorId);
    if (actorId === adminId) {
        throw new apiAppError_1.ApiAppError(400, "You cannot deactivate your own admin profile");
    }
    const admin = await getActiveAdminById(adminId);
    if (admin.role === client_1.UserRole.SUPER_ADMIN) {
        throw new apiAppError_1.ApiAppError(403, "Super admin profiles cannot be deactivated");
    }
    return prisma_client_1.prismaC.user.update({
        where: { id: adminId },
        data: { isDeleted: true },
        select: adminProfileSelect,
    });
};
const deactivateAdminWithVerification = async (actorId, adminId, payload) => {
    await verifyActorPassword(actorId, payload.currentPassword);
    return deactivateAdmin(actorId, adminId);
};
const restoreAdmin = async (actorId, adminId, payload) => {
    await verifyActorPassword(actorId, payload.currentPassword);
    const admin = await prisma_client_1.prismaC.user.findFirst({
        where: {
            id: adminId,
            role: client_1.UserRole.ADMIN,
            isDeleted: true,
        },
    });
    if (!admin) {
        throw new apiAppError_1.ApiAppError(404, "Inactive admin profile not found");
    }
    return prisma_client_1.prismaC.user.update({
        where: { id: adminId },
        data: { isDeleted: false },
        select: adminProfileSelect,
    });
};
const getUsers = async (query) => {
    const where = {
        ...(query.role ? { role: query.role } : {}),
        ...(query.status === "active" ? { isDeleted: false } : {}),
        ...(query.status === "inactive" ? { isDeleted: true } : {}),
        ...(query.search
            ? {
                OR: [
                    { email: { contains: query.search, mode: "insensitive" } },
                    { name: { contains: query.search, mode: "insensitive" } },
                    { phone: { contains: query.search, mode: "insensitive" } },
                ],
            }
            : {}),
    };
    return prisma_client_1.prismaC.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: adminProfileSelect,
    });
};
const getUserById = async (userId) => {
    const user = await prisma_client_1.prismaC.user.findUnique({
        where: { id: userId },
        select: {
            ...adminProfileSelect,
            _count: {
                select: {
                    orders: true,
                    reviews: true,
                    addresses: true,
                },
            },
        },
    });
    if (!user) {
        throw new apiAppError_1.ApiAppError(404, "User not found");
    }
    return user;
};
const updateUserStatus = async (actorId, userId, payload) => {
    const actor = await getActiveAdminById(actorId);
    const user = await prisma_client_1.prismaC.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new apiAppError_1.ApiAppError(404, "User not found");
    }
    if (actorId === userId) {
        throw new apiAppError_1.ApiAppError(400, "You cannot change your own account status");
    }
    if (user.role === client_1.UserRole.SUPER_ADMIN) {
        throw new apiAppError_1.ApiAppError(403, "Super admin status cannot be changed");
    }
    if (user.role === client_1.UserRole.ADMIN && actor.role !== client_1.UserRole.SUPER_ADMIN) {
        throw new apiAppError_1.ApiAppError(403, "Only super admins can manage admin status");
    }
    const updatedUser = await prisma_client_1.prismaC.user.update({
        where: { id: userId },
        data: { isDeleted: payload.isDeleted },
        select: adminProfileSelect,
    });
    await createAuditLog({
        actorId,
        action: payload.isDeleted ? "USER_DEACTIVATED" : "USER_RESTORED",
        entityType: "User",
        entityId: userId,
        metadata: {
            reason: payload.reason,
            previousStatus: user.isDeleted ? "inactive" : "active",
            newStatus: payload.isDeleted ? "inactive" : "active",
        },
    });
    return updatedUser;
};
const resolveCustomerIssue = async (actorId, userId, payload) => {
    const user = await prisma_client_1.prismaC.user.findFirst({
        where: {
            id: userId,
            role: client_1.UserRole.CUSTOMER,
        },
        select: adminProfileSelect,
    });
    if (!user) {
        throw new apiAppError_1.ApiAppError(404, "Customer account not found");
    }
    await createAuditLog({
        actorId,
        action: "CUSTOMER_ACCOUNT_ISSUE_RESOLVED",
        entityType: "User",
        entityId: userId,
        metadata: {
            note: payload.note,
            customerEmail: user.email,
        },
    });
    return { resolved: true };
};
const orderInclude = {
    user: { select: { id: true, email: true, name: true, phone: true } },
    address: true,
    payment: true,
    items: {
        include: {
            giftCardProduct: { select: { id: true, title: true, image: true } },
            giftCardDenomination: true,
            gameTopUpProduct: { select: { id: true, title: true, logo: true } },
            gameTopUpPackage: true,
            subscriptionProduct: { select: { id: true, title: true, logo: true } },
            subscriptionPlan: true,
        },
    },
};
const getOrders = async (query) => {
    const where = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.search
            ? {
                OR: [
                    { orderNumber: { contains: query.search, mode: "insensitive" } },
                    { user: { email: { contains: query.search, mode: "insensitive" } } },
                    { user: { name: { contains: query.search, mode: "insensitive" } } },
                ],
            }
            : {}),
    };
    return prisma_client_1.prismaC.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: orderInclude,
    });
};
const getOrderById = async (orderId) => {
    const order = await prisma_client_1.prismaC.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
    });
    if (!order) {
        throw new apiAppError_1.ApiAppError(404, "Order not found");
    }
    return order;
};
const updateOrderStatus = async (actorId, orderId, payload) => {
    const existingOrder = await prisma_client_1.prismaC.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, notes: true },
    });
    if (!existingOrder) {
        throw new apiAppError_1.ApiAppError(404, "Order not found");
    }
    const order = await prisma_client_1.prismaC.order.update({
        where: { id: orderId },
        data: {
            status: payload.status,
            ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        },
        include: orderInclude,
    });
    await createAuditLog({
        actorId,
        action: "ORDER_STATUS_UPDATED",
        entityType: "Order",
        entityId: orderId,
        metadata: {
            previousStatus: existingOrder.status,
            newStatus: payload.status,
            notes: payload.notes,
        },
    });
    return order;
};
const getDeliveryItems = async (query) => {
    return prisma_client_1.prismaC.orderItem.findMany({
        where: {
            ...(query.deliveryStatus ? { deliveryStatus: query.deliveryStatus } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    paymentStatus: true,
                    user: { select: { id: true, email: true, name: true, phone: true } },
                },
            },
            giftCardProduct: { select: { id: true, title: true, image: true } },
            giftCardDenomination: true,
            gameTopUpProduct: { select: { id: true, title: true, logo: true } },
            gameTopUpPackage: true,
            subscriptionProduct: { select: { id: true, title: true, logo: true } },
            subscriptionPlan: true,
        },
    });
};
const updateDeliveryStatus = async (actorId, orderItemId, payload) => {
    const existingItem = await prisma_client_1.prismaC.orderItem.findUnique({
        where: { id: orderItemId },
        select: { id: true, deliveryStatus: true },
    });
    if (!existingItem) {
        throw new apiAppError_1.ApiAppError(404, "Order item not found");
    }
    const item = await prisma_client_1.prismaC.orderItem.update({
        where: { id: orderItemId },
        data: {
            deliveryStatus: payload.deliveryStatus,
            ...(payload.fulfillmentReference !== undefined
                ? { fulfillmentReference: payload.fulfillmentReference }
                : {}),
            ...(payload.deliveryStatus === client_1.DeliveryStatus.DELIVERED
                ? { fulfilledAt: new Date() }
                : { fulfilledAt: null }),
        },
        include: {
            order: { select: { id: true, orderNumber: true, userId: true } },
            giftCardProduct: { select: { id: true, title: true, image: true } },
            giftCardDenomination: true,
            gameTopUpProduct: { select: { id: true, title: true, logo: true } },
            gameTopUpPackage: true,
            subscriptionProduct: { select: { id: true, title: true, logo: true } },
            subscriptionPlan: true,
        },
    });
    await createAuditLog({
        actorId,
        action: "DELIVERY_STATUS_UPDATED",
        entityType: "OrderItem",
        entityId: orderItemId,
        metadata: {
            previousStatus: existingItem.deliveryStatus,
            newStatus: payload.deliveryStatus,
            fulfillmentReference: payload.fulfillmentReference,
        },
    });
    return item;
};
const getPayments = async (query) => {
    return prisma_client_1.prismaC.payment.findMany({
        where: {
            ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    totalCost: true,
                    status: true,
                    paymentStatus: true,
                    user: { select: { id: true, email: true, name: true, phone: true } },
                },
            },
        },
    });
};
const getPaymentById = async (paymentId) => {
    const payment = await prisma_client_1.prismaC.payment.findUnique({
        where: { id: paymentId },
        include: {
            order: {
                include: {
                    user: { select: { id: true, email: true, name: true, phone: true } },
                    items: true,
                },
            },
        },
    });
    if (!payment) {
        throw new apiAppError_1.ApiAppError(404, "Payment not found");
    }
    return payment;
};
const verifyPaymentIssue = async (actorId, paymentId, payload) => {
    const payment = await prisma_client_1.prismaC.payment.findUnique({
        where: { id: paymentId },
        select: { id: true, paymentStatus: true, orderId: true },
    });
    if (!payment) {
        throw new apiAppError_1.ApiAppError(404, "Payment not found");
    }
    const paidAt = payload.paymentStatus === client_1.PaymentStatus.PAID ? new Date() : null;
    const updatedPayment = await prisma_client_1.prismaC.$transaction(async (tx) => {
        const updated = await tx.payment.update({
            where: { id: paymentId },
            data: {
                paymentStatus: payload.paymentStatus,
                ...(payload.transactionId !== undefined
                    ? { transactionId: payload.transactionId }
                    : {}),
                ...(payload.providerPaymentId !== undefined
                    ? { providerPaymentId: payload.providerPaymentId }
                    : {}),
                ...(payload.failureReason !== undefined
                    ? { failureReason: payload.failureReason }
                    : {}),
                ...(payload.rawResponse !== undefined
                    ? { rawResponse: payload.rawResponse }
                    : {}),
                paidAt,
            },
            include: {
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                        totalCost: true,
                        paymentStatus: true,
                        status: true,
                    },
                },
            },
        });
        await tx.order.update({
            where: { id: payment.orderId },
            data: {
                paymentStatus: payload.paymentStatus,
                ...(payload.paymentStatus === client_1.PaymentStatus.PAID
                    ? { status: client_1.OrderStatus.CONFIRMED }
                    : {}),
            },
        });
        return updated;
    });
    await createAuditLog({
        actorId,
        action: "PAYMENT_ISSUE_VERIFIED",
        entityType: "Payment",
        entityId: paymentId,
        metadata: {
            previousStatus: payment.paymentStatus,
            newStatus: payload.paymentStatus,
            transactionId: payload.transactionId,
            providerPaymentId: payload.providerPaymentId,
            failureReason: payload.failureReason,
        },
    });
    return updatedPayment;
};
const getDigitalProductOverview = async () => {
    const [giftCards, topUps, subscriptions, inactiveGiftCards, inactiveTopUps, inactiveSubscriptions, lowGiftCardStock, lowTopUpStock, lowSubscriptionStock,] = await Promise.all([
        prisma_client_1.prismaC.giftCardProduct.count({ where: { deletedAt: null } }),
        prisma_client_1.prismaC.gameTopUpProduct.count({ where: { deletedAt: null } }),
        prisma_client_1.prismaC.subscriptionProduct.count({ where: { deletedAt: null } }),
        prisma_client_1.prismaC.giftCardProduct.count({
            where: { status: { not: client_1.ProductStatus.ACTIVE }, deletedAt: null },
        }),
        prisma_client_1.prismaC.gameTopUpProduct.count({
            where: { status: { not: client_1.ProductStatus.ACTIVE }, deletedAt: null },
        }),
        prisma_client_1.prismaC.subscriptionProduct.count({
            where: { status: { not: client_1.ProductStatus.ACTIVE }, deletedAt: null },
        }),
        prisma_client_1.prismaC.giftCardDenomination.findMany({
            where: {
                stockQuantity: { lte: 5 },
                giftCardProduct: { is: { deletedAt: null } },
            },
            orderBy: { stockQuantity: "asc" },
            take: 20,
            include: { giftCardProduct: { select: { id: true, title: true, image: true } } },
        }),
        prisma_client_1.prismaC.gameTopUpPackage.findMany({
            where: {
                stockQuantity: { lte: 5 },
                gameTopUpProduct: { is: { deletedAt: null } },
            },
            orderBy: { stockQuantity: "asc" },
            take: 20,
            include: { gameTopUpProduct: { select: { id: true, title: true, logo: true } } },
        }),
        prisma_client_1.prismaC.subscriptionPlan.findMany({
            where: {
                stockQuantity: { lte: 5 },
                subscriptionProduct: { is: { deletedAt: null } },
            },
            orderBy: { stockQuantity: "asc" },
            take: 20,
            include: {
                subscriptionProduct: { select: { id: true, title: true, logo: true } },
            },
        }),
    ]);
    const lowStock = [
        ...lowGiftCardStock.map((option) => ({
            ...option,
            productType: client_1.DigitalProductType.GIFT_CARD,
            product: option.giftCardProduct,
        })),
        ...lowTopUpStock.map((option) => ({
            ...option,
            productType: client_1.DigitalProductType.GAME_TOP_UP,
            product: option.gameTopUpProduct,
        })),
        ...lowSubscriptionStock.map((option) => ({
            ...option,
            productType: client_1.DigitalProductType.SUBSCRIPTION,
            product: option.subscriptionProduct,
        })),
    ]
        .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0))
        .slice(0, 20);
    return {
        counts: {
            giftCards,
            topUps,
            subscriptions,
            inactiveDigitalProducts: inactiveGiftCards + inactiveTopUps + inactiveSubscriptions,
        },
        lowStock,
    };
};
const getDigitalProducts = async (query) => {
    const status = query.isActive === undefined
        ? undefined
        : query.isActive === "true"
            ? client_1.ProductStatus.ACTIVE
            : { not: client_1.ProductStatus.ACTIVE };
    const category = { select: { id: true, title: true } };
    const [giftCards, topUps, subscriptions] = await Promise.all([
        !query.type || query.type === client_1.DigitalProductType.GIFT_CARD
            ? prisma_client_1.prismaC.giftCardProduct.findMany({
                where: {
                    deletedAt: null,
                    ...(status ? { status } : {}),
                    ...(query.search
                        ? {
                            OR: ["title", "brand", "slug"].map((field) => ({
                                [field]: { contains: query.search, mode: "insensitive" },
                            })),
                        }
                        : {}),
                },
                orderBy: { createdAt: "desc" },
                include: { category, denominations: true },
            })
            : [],
        !query.type || query.type === client_1.DigitalProductType.GAME_TOP_UP
            ? prisma_client_1.prismaC.gameTopUpProduct.findMany({
                where: {
                    deletedAt: null,
                    ...(status ? { status } : {}),
                    ...(query.search
                        ? {
                            OR: ["title", "name", "slug"].map((field) => ({
                                [field]: { contains: query.search, mode: "insensitive" },
                            })),
                        }
                        : {}),
                },
                orderBy: { createdAt: "desc" },
                include: { category, packages: true, inputFields: true },
            })
            : [],
        !query.type || query.type === client_1.DigitalProductType.SUBSCRIPTION
            ? prisma_client_1.prismaC.subscriptionProduct.findMany({
                where: {
                    deletedAt: null,
                    ...(status ? { status } : {}),
                    ...(query.search
                        ? {
                            OR: ["title", "platformName", "slug"].map((field) => ({
                                [field]: { contains: query.search, mode: "insensitive" },
                            })),
                        }
                        : {}),
                },
                orderBy: { createdAt: "desc" },
                include: { category, plans: true, inputFields: true },
            })
            : [],
    ]);
    return [
        ...giftCards.map((product) => ({
            ...product,
            productType: client_1.DigitalProductType.GIFT_CARD,
        })),
        ...topUps.map((product) => ({
            ...product,
            productType: client_1.DigitalProductType.GAME_TOP_UP,
        })),
        ...subscriptions.map((product) => ({
            ...product,
            productType: client_1.DigitalProductType.SUBSCRIPTION,
        })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};
const getSalesStats = async (query) => {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const createdAt = from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
        }
        : undefined;
    const [paidAggregate, totalOrders, pendingPayments, failedPayments, recentOrders] = await Promise.all([
        prisma_client_1.prismaC.order.aggregate({
            where: {
                paymentStatus: client_1.PaymentStatus.PAID,
                ...(createdAt ? { createdAt } : {}),
            },
            _sum: { totalCost: true },
            _count: { id: true },
        }),
        prisma_client_1.prismaC.order.count({
            where: {
                ...(createdAt ? { createdAt } : {}),
            },
        }),
        prisma_client_1.prismaC.order.count({
            where: {
                paymentStatus: client_1.PaymentStatus.PENDING,
                ...(createdAt ? { createdAt } : {}),
            },
        }),
        prisma_client_1.prismaC.order.count({
            where: {
                paymentStatus: client_1.PaymentStatus.FAILED,
                ...(createdAt ? { createdAt } : {}),
            },
        }),
        prisma_client_1.prismaC.order.findMany({
            where: {
                ...(createdAt ? { createdAt } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                orderNumber: true,
                totalCost: true,
                status: true,
                paymentStatus: true,
                createdAt: true,
            },
        }),
    ]);
    return {
        totalSales: Number(paidAggregate._sum.totalCost || 0),
        paidOrders: paidAggregate._count.id,
        totalOrders,
        pendingPayments,
        failedPayments,
        recentOrders,
    };
};
const getAuditLogs = async () => {
    return prisma_client_1.prismaC.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
            actor: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                },
            },
        },
    });
};
exports.adminService = {
    createAdmin,
    getAdmins,
    getAdminById,
    getOwnProfile,
    updateOwnProfile,
    updateAdminById,
    changeOwnPassword,
    deactivateAdmin: deactivateAdminWithVerification,
    restoreAdmin,
    getUsers,
    getUserById,
    updateUserStatus,
    resolveCustomerIssue,
    getOrders,
    getOrderById,
    updateOrderStatus,
    getDeliveryItems,
    updateDeliveryStatus,
    getPayments,
    getPaymentById,
    verifyPaymentIssue,
    getDigitalProducts,
    getDigitalProductOverview,
    getSalesStats,
    getAuditLogs,
};
