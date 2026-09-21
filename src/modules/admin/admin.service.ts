import bcrypt from "bcryptjs";
import {
  DeliveryStatus,
  DigitalProductType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
  UserRole,
} from "../../generated/prisma/client";
import { ApiAppError } from "../../utils/apiAppError";
import { ENV } from "../../utils/env-config";
import { prismaC } from "../../utils/prisma-client";
import type {
  AdminUserQuery,
  ChangeAdminPasswordPayload,
  CreateAdminPayload,
  DateRangeQuery,
  DeliveryQuery,
  DigitalProductQuery,
  ManageAdminProfilePayload,
  OrderQuery,
  PaymentQuery,
  ResolveCustomerIssuePayload,
  UpdateAdminProfilePayload,
  UpdateDeliveryStatusPayload,
  UpdateOrderStatusPayload,
  UpdateUserStatusPayload,
  VerifyPaymentIssuePayload,
  VerifyAdminActionPayload,
} from "./admin.validation";
import { assertPaymentTransition } from "../payment/services/payment-state-machine";

const adminProfileSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} as const;

const adminRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
const digitalProductTypes = [
  DigitalProductType.GIFT_CARD,
  DigitalProductType.GAME_TOP_UP,
  DigitalProductType.SUBSCRIPTION,
];

const isPrismaKnownError = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === code;

const getActiveAdminById = async (adminId: string) => {
  const admin = await prismaC.user.findFirst({
    where: {
      id: adminId,
      role: { in: adminRoles },
      isActive: true,
      isDeleted: false,
    },
  });

  if (!admin) {
    throw new ApiAppError(404, "Admin profile not found");
  }

  return admin;
};

const createAuditLog = async (payload: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}) => {
  await prismaC.auditLog.create({
    data: {
      actorId: payload.actorId,
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId,
      metadata: payload.metadata,
    },
  });
};

const verifyActorPassword = async (actorId: string, currentPassword: string) => {
  const actor = await getActiveAdminById(actorId);
  const isPasswordMatched = await bcrypt.compare(currentPassword, actor.password);

  if (!isPasswordMatched) {
    throw new ApiAppError(401, "Invalid current password");
  }

  return actor;
};

const createAdmin = async (actorId: string, payload: CreateAdminPayload) => {
  await verifyActorPassword(actorId, payload.currentPassword);

  const existingUser = await prismaC.user.findUnique({
    where: { email: payload.email },
  });

  if (existingUser) {
    throw new ApiAppError(409, "User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(payload.password, ENV.BCRYPT_SALT);

  try {
    return await prismaC.user.create({
      data: {
        email: payload.email,
        name: payload.name,
        phone: payload.phone,
        password: hashedPassword,
        role: UserRole.ADMIN,
      },
      select: adminProfileSelect,
    });
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      throw new ApiAppError(409, "User with this email already exists");
    }

    throw new ApiAppError(500, "Failed to create admin profile", error);
  }
};

const getAdmins = async (includeInactive = false) => {
  return prismaC.user.findMany({
    where: {
      role: { in: adminRoles },
      ...(includeInactive ? {} : { isDeleted: false }),
    },
    orderBy: { createdAt: "desc" },
    select: adminProfileSelect,
  });
};

const getAdminById = async (adminId: string) => {
  const admin = await prismaC.user.findFirst({
    where: {
      id: adminId,
      role: { in: adminRoles },
    },
    select: adminProfileSelect,
  });

  if (!admin) {
    throw new ApiAppError(404, "Admin profile not found");
  }

  return admin;
};

const getOwnProfile = async (adminId: string) => {
  await getActiveAdminById(adminId);

  return prismaC.user.findUnique({
    where: { id: adminId },
    select: adminProfileSelect,
  });
};

const updateOwnProfile = async (
  adminId: string,
  payload: UpdateAdminProfilePayload,
) => {
  await getActiveAdminById(adminId);

  return prismaC.user.update({
    where: { id: adminId },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
    },
    select: adminProfileSelect,
  });
};

const updateAdminById = async (
  actorId: string,
  adminId: string,
  payload: ManageAdminProfilePayload,
) => {
  await verifyActorPassword(actorId, payload.currentPassword);

  const admin = await getActiveAdminById(adminId);

  if (admin.role === UserRole.SUPER_ADMIN) {
    throw new ApiAppError(403, "Super admin profiles can only be updated by themselves");
  }

  return prismaC.user.update({
    where: { id: adminId },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
    },
    select: adminProfileSelect,
  });
};

const changeOwnPassword = async (
  adminId: string,
  payload: ChangeAdminPasswordPayload,
) => {
  const admin = await getActiveAdminById(adminId);
  const isPasswordMatched = await bcrypt.compare(
    payload.currentPassword,
    admin.password,
  );

  if (!isPasswordMatched) {
    throw new ApiAppError(401, "Invalid current password");
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, ENV.BCRYPT_SALT);

  await prismaC.user.update({
    where: { id: adminId },
    data: { password: hashedPassword },
  });

  return { changed: true };
};

const deactivateAdmin = async (actorId: string, adminId: string) => {
  await getActiveAdminById(actorId);

  if (actorId === adminId) {
    throw new ApiAppError(400, "You cannot deactivate your own admin profile");
  }

  const admin = await getActiveAdminById(adminId);

  if (admin.role === UserRole.SUPER_ADMIN) {
    throw new ApiAppError(403, "Super admin profiles cannot be deactivated");
  }

  return prismaC.user.update({
    where: { id: adminId },
    data: { isDeleted: true },
    select: adminProfileSelect,
  });
};

const deactivateAdminWithVerification = async (
  actorId: string,
  adminId: string,
  payload: VerifyAdminActionPayload,
) => {
  await verifyActorPassword(actorId, payload.currentPassword);

  return deactivateAdmin(actorId, adminId);
};

const restoreAdmin = async (
  actorId: string,
  adminId: string,
  payload: VerifyAdminActionPayload,
) => {
  await verifyActorPassword(actorId, payload.currentPassword);

  const admin = await prismaC.user.findFirst({
    where: {
      id: adminId,
      role: UserRole.ADMIN,
      isDeleted: true,
    },
  });

  if (!admin) {
    throw new ApiAppError(404, "Inactive admin profile not found");
  }

  return prismaC.user.update({
    where: { id: adminId },
    data: { isDeleted: false },
    select: adminProfileSelect,
  });
};

const getUsers = async (query: AdminUserQuery) => {
  const where: Prisma.UserWhereInput = {
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

  return prismaC.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: adminProfileSelect,
  });
};

const getUserById = async (userId: string) => {
  const user = await prismaC.user.findUnique({
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
    throw new ApiAppError(404, "User not found");
  }

  return user;
};

const updateUserStatus = async (
  actorId: string,
  userId: string,
  payload: UpdateUserStatusPayload,
) => {
  const actor = await getActiveAdminById(actorId);
  const user = await prismaC.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new ApiAppError(404, "User not found");
  }

  if (actorId === userId) {
    throw new ApiAppError(400, "You cannot change your own account status");
  }

  if (user.role === UserRole.SUPER_ADMIN) {
    throw new ApiAppError(403, "Super admin status cannot be changed");
  }

  if (user.role === UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new ApiAppError(403, "Only super admins can manage admin status");
  }

  const updatedUser = await prismaC.user.update({
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

const resolveCustomerIssue = async (
  actorId: string,
  userId: string,
  payload: ResolveCustomerIssuePayload,
) => {
  const user = await prismaC.user.findFirst({
    where: {
      id: userId,
      role: UserRole.CUSTOMER,
    },
    select: adminProfileSelect,
  });

  if (!user) {
    throw new ApiAppError(404, "Customer account not found");
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
} satisfies Prisma.OrderInclude;

const getOrders = async (query: OrderQuery) => {
  const where: Prisma.OrderWhereInput = {
    items: { none: { productType: DigitalProductType.GAME_TOP_UP } },
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

  return prismaC.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: orderInclude,
  });
};

const getOrderById = async (orderId: string) => {
  const topUpItem = await prismaC.orderItem.count({
    where: { orderId, productType: DigitalProductType.GAME_TOP_UP },
  });
  if (topUpItem) {
    throw new ApiAppError(409, "Use the game top-up detail endpoint for this order");
  }
  const order = await prismaC.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });

  if (!order) {
    throw new ApiAppError(404, "Order not found");
  }

  return order;
};

const updateOrderStatus = async (
  actorId: string,
  orderId: string,
  payload: UpdateOrderStatusPayload,
) => {
  const existingOrder = await prismaC.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, notes: true },
  });

  if (!existingOrder) {
    throw new ApiAppError(404, "Order not found");
  }

  const hasTopUp = await prismaC.orderItem.count({
    where: { orderId, productType: DigitalProductType.GAME_TOP_UP },
  });
  if (hasTopUp) {
    throw new ApiAppError(409, "Use the game top-up workflow endpoints to change this order");
  }

  const order = await prismaC.order.update({
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

const getDeliveryItems = async (query: DeliveryQuery) => {
  return prismaC.orderItem.findMany({
    where: {
      productType: { not: DigitalProductType.GAME_TOP_UP },
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

const updateDeliveryStatus = async (
  actorId: string,
  orderItemId: string,
  payload: UpdateDeliveryStatusPayload,
) => {
  const existingItem = await prismaC.orderItem.findUnique({
    where: { id: orderItemId },
    select: { id: true, deliveryStatus: true },
  });

  if (!existingItem) {
    throw new ApiAppError(404, "Order item not found");
  }

  const topUpItem = await prismaC.orderItem.count({
    where: { id: orderItemId, productType: DigitalProductType.GAME_TOP_UP },
  });
  if (topUpItem) {
    throw new ApiAppError(409, "Use the game top-up workflow endpoints to change this item");
  }

  const item = await prismaC.orderItem.update({
    where: { id: orderItemId },
    data: {
      deliveryStatus: payload.deliveryStatus,
      ...(payload.fulfillmentReference !== undefined
        ? { fulfillmentReference: payload.fulfillmentReference }
        : {}),
      ...(payload.deliveryStatus === DeliveryStatus.DELIVERED
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

const getPayments = async (query: PaymentQuery) => {
  return prismaC.payment.findMany({
    where: {
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      attempts: { orderBy: { createdAt: "desc" } },
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

const getPaymentById = async (paymentId: string) => {
  const payment = await prismaC.payment.findUnique({
    where: { id: paymentId },
    include: {
      attempts: { orderBy: { createdAt: "desc" } },
      order: {
        include: {
          user: { select: { id: true, email: true, name: true, phone: true } },
          items: true,
        },
      },
    },
  });

  if (!payment) {
    throw new ApiAppError(404, "Payment not found");
  }

  return {
    ...payment,
    order: {
      ...payment.order,
      items: payment.order.items.map((item) =>
        item.productType === DigitalProductType.GAME_TOP_UP
          ? { ...item, customerInputs: undefined }
          : item,
      ),
    },
  };
};

const verifyPaymentIssue = async (
  actorId: string,
  paymentId: string,
  payload: VerifyPaymentIssuePayload,
) => {
  const payment = await prismaC.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, paymentStatus: true, orderId: true },
  });

  if (!payment) {
    throw new ApiAppError(404, "Payment not found");
  }

  const updatedPayment = await prismaC.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "payments" WHERE "id" = ${paymentId} FOR UPDATE`);
    const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assertPaymentTransition(current.paymentStatus, payload.paymentStatus);
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        paymentStatus: payload.paymentStatus,
        failureReason: payload.failureReason,
        reconciliationReason: payload.failureReason,
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
        status: payload.paymentStatus === PaymentStatus.REFUNDED
          ? OrderStatus.CANCELLED
          : OrderStatus.REFUND_PENDING,
      },
    });

    await tx.paymentAttempt.updateMany({ where: { paymentRecordId: paymentId }, data: {
      status: payload.paymentStatus, failureReason: payload.failureReason,
    } });

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
      failureReason: payload.failureReason,
    },
  });

  return updatedPayment;
};

const getDigitalProductOverview = async () => {
  const [
    giftCards,
    topUps,
    subscriptions,
    inactiveGiftCards,
    inactiveTopUps,
    inactiveSubscriptions,
    lowGiftCardStock,
    lowTopUpStock,
    lowSubscriptionStock,
  ] =
    await Promise.all([
      prismaC.giftCardProduct.count({ where: { deletedAt: null } }),
      prismaC.gameTopUpProduct.count({ where: { deletedAt: null } }),
      prismaC.subscriptionProduct.count({ where: { deletedAt: null } }),
      prismaC.giftCardProduct.count({
        where: { status: { not: ProductStatus.ACTIVE }, deletedAt: null },
      }),
      prismaC.gameTopUpProduct.count({
        where: { status: { not: ProductStatus.ACTIVE }, deletedAt: null },
      }),
      prismaC.subscriptionProduct.count({
        where: { status: { not: ProductStatus.ACTIVE }, deletedAt: null },
      }),
      prismaC.giftCardDenomination.findMany({
        where: {
          stockQuantity: { lte: 5 },
          giftCardProduct: { is: { deletedAt: null } },
        },
        orderBy: { stockQuantity: "asc" },
        take: 20,
        include: { giftCardProduct: { select: { id: true, title: true, image: true } } },
      }),
      prismaC.gameTopUpPackage.findMany({
        where: {
          stockQuantity: { lte: 5 },
          gameTopUpProduct: { is: { deletedAt: null } },
        },
        orderBy: { stockQuantity: "asc" },
        take: 20,
        include: { gameTopUpProduct: { select: { id: true, title: true, logo: true } } },
      }),
      prismaC.subscriptionPlan.findMany({
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
      productType: DigitalProductType.GIFT_CARD,
      product: option.giftCardProduct,
    })),
    ...lowTopUpStock.map((option) => ({
      ...option,
      productType: DigitalProductType.GAME_TOP_UP,
      product: option.gameTopUpProduct,
    })),
    ...lowSubscriptionStock.map((option) => ({
      ...option,
      productType: DigitalProductType.SUBSCRIPTION,
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
      inactiveDigitalProducts:
        inactiveGiftCards + inactiveTopUps + inactiveSubscriptions,
    },
    lowStock,
  };
};

const getDigitalProducts = async (query: DigitalProductQuery) => {
  const status =
    query.isActive === undefined
      ? undefined
      : query.isActive === "true"
        ? ProductStatus.ACTIVE
        : { not: ProductStatus.ACTIVE };
  const category = { select: { id: true, title: true } } as const;
  const [giftCards, topUps, subscriptions] = await Promise.all([
    !query.type || query.type === DigitalProductType.GIFT_CARD
      ? prismaC.giftCardProduct.findMany({
          where: {
            deletedAt: null,
            ...(status ? { status } : {}),
            ...(query.search
              ? {
                  OR: ["title", "brand", "slug"].map((field) => ({
                    [field]: { contains: query.search, mode: "insensitive" as const },
                  })),
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          include: { category, denominations: true },
        })
      : [],
    !query.type || query.type === DigitalProductType.GAME_TOP_UP
      ? prismaC.gameTopUpProduct.findMany({
          where: {
            deletedAt: null,
            ...(status ? { status } : {}),
            ...(query.search
              ? {
                  OR: ["title", "name", "slug"].map((field) => ({
                    [field]: { contains: query.search, mode: "insensitive" as const },
                  })),
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          include: { category, packages: true, inputFields: true },
        })
      : [],
    !query.type || query.type === DigitalProductType.SUBSCRIPTION
      ? prismaC.subscriptionProduct.findMany({
          where: {
            deletedAt: null,
            ...(status ? { status } : {}),
            ...(query.search
              ? {
                  OR: ["title", "platformName", "slug"].map((field) => ({
                    [field]: { contains: query.search, mode: "insensitive" as const },
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
      productType: DigitalProductType.GIFT_CARD,
    })),
    ...topUps.map((product) => ({
      ...product,
      productType: DigitalProductType.GAME_TOP_UP,
    })),
    ...subscriptions.map((product) => ({
      ...product,
      productType: DigitalProductType.SUBSCRIPTION,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

const getSalesStats = async (query: DateRangeQuery) => {
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;
  const createdAt =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  const [paidAggregate, totalOrders, pendingPayments, failedPayments, recentOrders] =
    await Promise.all([
      prismaC.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
          ...(createdAt ? { createdAt } : {}),
        },
        _sum: { totalCost: true },
        _count: { id: true },
      }),
      prismaC.order.count({
        where: {
          ...(createdAt ? { createdAt } : {}),
        },
      }),
      prismaC.order.count({
        where: {
          paymentStatus: PaymentStatus.PENDING,
          ...(createdAt ? { createdAt } : {}),
        },
      }),
      prismaC.order.count({
        where: {
          paymentStatus: PaymentStatus.FAILED,
          ...(createdAt ? { createdAt } : {}),
        },
      }),
      prismaC.order.findMany({
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
  return prismaC.auditLog.findMany({
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

export const adminService = {
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
