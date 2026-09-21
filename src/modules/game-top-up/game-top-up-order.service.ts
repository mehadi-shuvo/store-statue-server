import {
  DeliveryStatus, DigitalProductType, OrderStatus, PaymentStatus, ProductStatus,
  Prisma, type Prisma as PrismaTypes,
} from "../../generated/prisma/client";
import { randomUUID } from "node:crypto";
import { prismaC } from "../../utils/prisma-client";
import { gameTopUpError } from "./game-top-up.errors";
import type { CompleteTopUpOrderInput, CreateTopUpOrderInput, FailTopUpOrderInput } from "./game-top-up.validation";
import { createTopUpOrderNumber, maskAccountDetails, moneyString, validateAccountDetails } from "./game-top-up.utils";
import { getGameTopUpProvider } from "./providers/game-top-up-provider.factory";

type TopUpApiStatus = "PENDING" | "QUEUED" | "PROCESSING" | "PROVIDER_PENDING" | "COMPLETED" | "CANCELLED" | "FAILED" | "FAILED_RETRYABLE" | "FAILED_FINAL" | "MANUAL_REVIEW";
type CustomerQuery = { page: number; limit: number; status?: TopUpApiStatus; paymentStatus?: PaymentStatus };
type AdminQuery = CustomerQuery & { gameId?: string; userId?: string; serial?: number; date?: string };

const apiStatus = (status: DeliveryStatus) => status === DeliveryStatus.DELIVERED ? "COMPLETED" : status;
const fulfillmentStatus = (status: DeliveryStatus) => status === DeliveryStatus.DELIVERED ? "SUCCESS" : status;
const databaseStatus = (status?: TopUpApiStatus) => status === "COMPLETED" ? DeliveryStatus.DELIVERED : status as DeliveryStatus | undefined;

const fulfillmentProvider = (value: PrismaTypes.JsonValue | null) => {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return typeof value.provider === "string" ? value.provider : null;
};

const customerItemSelect = {
  id: true, productTitle: true, optionTitle: true, productImage: true,
  unitPrice: true, deliveryStatus: true, customerInputs: true, failureReason: true,
  fulfillmentReference: true, fulfillmentData: true, createdAt: true, updatedAt: true,
  gameTopUpProductId: true, gameTopUpPackageId: true,
  gameTopUpProduct: { select: { slug: true } },
  gameTopUpOrderDetail: true,
} as const;

const createOrder = async (userId: string, input: CreateTopUpOrderInput) => {
  const item = await prismaC.gameTopUpPackage.findUnique({
    where: { id: input.packageId },
    include: { gameTopUpProduct: { include: { inputFields: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } } },
  });
  if (!item) throw gameTopUpError(404, "PACKAGE_NOT_FOUND", "Top-up package not found");
  if (input.gameId && input.gameId !== item.gameTopUpProductId) {
    const gameExists = await prismaC.gameTopUpProduct.findFirst({
      where: { id: input.gameId, deletedAt: null },
      select: { id: true },
    });
    if (!gameExists) throw gameTopUpError(404, "GAME_NOT_FOUND", "Game not found");
    throw gameTopUpError(422, "PACKAGE_GAME_MISMATCH", "The selected package does not belong to this game");
  }
  if (!item.isActive) throw gameTopUpError(409, "PACKAGE_INACTIVE", "Top-up package is inactive");
  if (item.gameTopUpProduct.deletedAt || item.gameTopUpProduct.status !== ProductStatus.ACTIVE) {
    throw gameTopUpError(409, "GAME_INACTIVE", "Game is inactive");
  }
  if (item.stockQuantity !== null && item.stockQuantity < 1) {
    throw gameTopUpError(409, "PACKAGE_OUT_OF_STOCK", "Top-up package is out of stock");
  }

  const provider = getGameTopUpProvider();
  if (provider.getHealth) {
    const health = await provider.getHealth().catch(() => ({ available: false as const, reason: "PROVIDER_DOWN" as const }));
    const estimatedCost = Number(item.costPriceBDT ?? item.sellingPriceBDT);
    if (!health.available) {
      throw gameTopUpError(503, health.reason ?? "PROVIDER_DOWN", "Top-up service is temporarily unavailable");
    }
    if (health.balance !== undefined && health.balance < estimatedCost) {
      throw gameTopUpError(503, "INSUFFICIENT_PROVIDER_BALANCE", "Top-up service is temporarily unavailable");
    }
  }

  const accountDetails = validateAccountDetails(item.gameTopUpProduct.inputFields, input.accountDetails);
  const fulfillmentKey = `GX-TOPUP-${randomUUID()}`;
  const order = await prismaC.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: createTopUpOrderNumber(), userId,
        subtotal: item.sellingPriceBDT, discountTotal: new Prisma.Decimal(0), totalCost: item.sellingPriceBDT,
        status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING,
        items: {
          create: {
            productType: DigitalProductType.GAME_TOP_UP, quantity: 1,
            unitPrice: item.sellingPriceBDT, totalPrice: item.sellingPriceBDT,
            productTitle: item.gameTopUpProduct.title,
            optionTitle: item.title ?? `${item.gameCurrencyAmount} ${item.gameTopUpProduct.gameCurrencyName}`,
            productImage: item.gameTopUpProduct.logo,
            customerInputs: accountDetails,
            deliveryStatus: DeliveryStatus.PENDING,
            gameTopUpProductId: item.gameTopUpProductId,
            gameTopUpPackageId: item.id,
            gameTopUpOrderDetail: {
              create: {
                gameCurrencyAmountSnapshot: item.gameCurrencyAmount,
                bonusCurrencyAmountSnapshot: item.bonusCurrencyAmount,
                gameCurrencyLabelSnapshot: item.gameTopUpProduct.gameCurrencyName,
                providerProductIdSnapshot: item.providerProductId ?? item.id,
                fulfillmentKey,
              },
            },
          },
        },
      },
      include: { items: { include: { gameTopUpOrderDetail: true } } },
    });
    await tx.auditLog.create({
      data: { actorId: userId, action: "ORDER_CREATED", entityType: "GameTopUpOrder", entityId: created.id, metadata: { packageId: item.id, priceBdt: moneyString(item.sellingPriceBDT) } },
    });
    return created;
  });

  return {
    orderId: order.id, orderNumber: order.orderNumber,
    status: "PAYMENT_PENDING", paymentStatus: order.paymentStatus, fulfillmentStatus: "PENDING",
    dailySerial: null, queueDate: null, totalBdt: moneyString(order.totalCost),
  };
};

const listForCustomer = async (userId: string, query: CustomerQuery) => {
  const where: PrismaTypes.OrderWhereInput = {
    userId,
    ...(query.paymentStatus && { paymentStatus: query.paymentStatus }),
    items: { some: { productType: DigitalProductType.GAME_TOP_UP, ...(query.status && { deliveryStatus: databaseStatus(query.status) }) } },
  };
  const [orders, total] = await prismaC.$transaction([
    prismaC.order.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: "desc" },
      select: { id: true, orderNumber: true, totalCost: true, currency: true, paymentStatus: true, createdAt: true, updatedAt: true, items: { where: { productType: DigitalProductType.GAME_TOP_UP }, select: customerItemSelect } },
    }),
    prismaC.order.count({ where }),
  ]);
  return {
    data: orders.map((order) => ({
      id: order.id, orderNumber: order.orderNumber, totalBdt: moneyString(order.totalCost), amount: moneyString(order.totalCost), currency: order.currency, paymentStatus: order.paymentStatus, createdAt: order.createdAt, updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        id: item.id, game: item.productTitle, package: item.optionTitle, imageUrl: item.productImage,
        priceBdt: moneyString(item.unitPrice), status: apiStatus(item.deliveryStatus),
        fulfillmentStatus: fulfillmentStatus(item.deliveryStatus),
        providerName: fulfillmentProvider(item.fulfillmentData), providerOrderId: item.fulfillmentReference,
        accountDetails: maskAccountDetails(item.customerInputs),
        queueDate: item.gameTopUpOrderDetail?.queueDate?.toISOString().slice(0, 10) ?? null,
        dailySerial: item.gameTopUpOrderDetail?.dailySerial ?? null,
        coinAmount: item.gameTopUpOrderDetail?.gameCurrencyAmountSnapshot ?? null,
        bonusAmount: item.gameTopUpOrderDetail?.bonusCurrencyAmountSnapshot ?? null,
        coinLabel: item.gameTopUpOrderDetail?.gameCurrencyLabelSnapshot ?? null,
        submittedAt: item.createdAt,
      })),
    })),
    meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
  };
};

const getForCustomer = async (userId: string, orderId: string) => {
  const order = await prismaC.order.findFirst({
    where: { id: orderId, userId, items: { some: { productType: DigitalProductType.GAME_TOP_UP } } },
    select: {
      id: true, orderNumber: true, totalCost: true, currency: true, paymentStatus: true,
      createdAt: true, updatedAt: true,
      payment: { select: { paymentId: true, transactionId: true } },
      items: { where: { productType: DigitalProductType.GAME_TOP_UP }, select: customerItemSelect },
    },
  });
  if (!order) throw gameTopUpError(404, "ORDER_NOT_FOUND", "Top-up order not found");
  const primaryItem = order.items[0];
  if (!primaryItem) throw gameTopUpError(404, "ORDER_NOT_FOUND", "Top-up order not found");
  return {
    id: order.id, orderNumber: order.orderNumber, totalBdt: moneyString(order.totalCost), amount: moneyString(order.totalCost), currency: order.currency,
    paymentStatus: order.paymentStatus, transactionId: order.payment?.transactionId ?? order.payment?.paymentId ?? null,
    fulfillmentStatus: fulfillmentStatus(primaryItem.deliveryStatus),
    providerName: fulfillmentProvider(primaryItem.fulfillmentData), providerOrderId: primaryItem.fulfillmentReference,
    game: { id: primaryItem.gameTopUpProductId, title: primaryItem.productTitle, slug: primaryItem.gameTopUpProduct?.slug ?? null },
    package: { id: primaryItem.gameTopUpPackageId, title: primaryItem.optionTitle },
    accountDetails: maskAccountDetails(primaryItem.customerInputs),
    createdAt: order.createdAt, updatedAt: order.updatedAt,
    items: order.items.map((item) => ({
      id: item.id, game: item.productTitle, package: item.optionTitle, imageUrl: item.productImage,
      priceBdt: moneyString(item.unitPrice), status: apiStatus(item.deliveryStatus),
      fulfillmentStatus: fulfillmentStatus(item.deliveryStatus),
      gameId: item.gameTopUpProductId, gameSlug: item.gameTopUpProduct?.slug ?? null,
      packageId: item.gameTopUpPackageId,
      providerName: fulfillmentProvider(item.fulfillmentData), providerOrderId: item.fulfillmentReference,
      accountDetails: maskAccountDetails(item.customerInputs),
      queueDate: item.gameTopUpOrderDetail?.queueDate?.toISOString().slice(0, 10) ?? null,
      dailySerial: item.gameTopUpOrderDetail?.dailySerial ?? null,
      coinAmount: item.gameTopUpOrderDetail?.gameCurrencyAmountSnapshot ?? null,
      bonusAmount: item.gameTopUpOrderDetail?.bonusCurrencyAmountSnapshot ?? null,
      coinLabel: item.gameTopUpOrderDetail?.gameCurrencyLabelSnapshot ?? null,
      cancellableUntil: item.gameTopUpOrderDetail?.cancellableUntil ?? null,
      processingStartedAt: item.gameTopUpOrderDetail?.processingStartedAt ?? null,
      previousBalance: item.gameTopUpOrderDetail?.previousBalance?.toString() ?? null,
      currentBalance: item.gameTopUpOrderDetail?.currentBalance?.toString() ?? null,
      customerMessage: item.gameTopUpOrderDetail?.customerMessage ?? null,
      completedAt: item.gameTopUpOrderDetail?.completedAt ?? null,
      cancelledAt: item.gameTopUpOrderDetail?.cancelledAt ?? null,
      failedAt: item.gameTopUpOrderDetail?.failedAt ?? null,
      failureReason: ([DeliveryStatus.FAILED, DeliveryStatus.FAILED_RETRYABLE, DeliveryStatus.FAILED_FINAL, DeliveryStatus.MANUAL_REVIEW] as DeliveryStatus[]).includes(item.deliveryStatus) ? item.failureReason : null,
    })),
  };
};

const cancel = async (userId: string, orderId: string, now = new Date()) => prismaC.$transaction(async (tx) => {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`);
  const order = await tx.order.findFirst({
    where: { id: orderId, userId, items: { some: { productType: DigitalProductType.GAME_TOP_UP } } },
    select: { id: true, paymentStatus: true, items: { where: { productType: DigitalProductType.GAME_TOP_UP }, select: { id: true, deliveryStatus: true, gameTopUpOrderDetail: true } } },
  });
  if (!order) throw gameTopUpError(404, "ORDER_NOT_FOUND", "Top-up order not found");
  const item = order.items[0];
  const paid = order.paymentStatus === PaymentStatus.PAID;
  if (order.paymentStatus !== PaymentStatus.PENDING && !paid) {
    throw gameTopUpError(409, "ORDER_NOT_CANCELLABLE", "An initiated payment order cannot be cancelled");
  }
  if (item.deliveryStatus !== DeliveryStatus.PENDING || (paid && (!item.gameTopUpOrderDetail?.cancellableUntil || item.gameTopUpOrderDetail.cancellableUntil <= now))) {
    throw gameTopUpError(409, "ORDER_NOT_CANCELLABLE", "This order can no longer be cancelled");
  }
  const changed = await tx.orderItem.updateMany({
    where: {
      id: item.id,
      deliveryStatus: DeliveryStatus.PENDING,
      order: { userId, paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PAID] } },
      ...(paid && { gameTopUpOrderDetail: { is: { cancellableUntil: { gt: now } } } }),
    },
    data: { deliveryStatus: DeliveryStatus.CANCELLED },
  });
  if (changed.count !== 1) throw gameTopUpError(409, "ORDER_NOT_CANCELLABLE", "This order can no longer be cancelled");
  await tx.gameTopUpOrderDetail.update({ where: { orderItemId: item.id }, data: { cancelledAt: now, cancelledBy: "CUSTOMER" } });
  await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
  await tx.auditLog.create({ data: { actorId: userId, action: "ORDER_CANCELLED", entityType: "GameTopUpOrder", entityId: order.id } });
  return { orderId: order.id, status: "CANCELLED", cancelledAt: now };
});

const listForAdmin = async (query: AdminQuery) => {
  const queueDate = query.date ? new Date(`${query.date}T00:00:00.000Z`) : undefined;
  const itemWhere: PrismaTypes.OrderItemWhereInput = {
    productType: DigitalProductType.GAME_TOP_UP,
    gameTopUpOrderDetail: {
      is: {
        queueDate: queueDate ?? { not: null },
        ...(query.serial && { dailySerial: query.serial }),
      },
    },
    ...(query.status && { deliveryStatus: databaseStatus(query.status) }),
    ...(query.gameId && { gameTopUpProductId: query.gameId }),
    ...((query.userId || query.paymentStatus) && {
      order: {
        ...(query.userId && { userId: query.userId }),
        ...(query.paymentStatus && { paymentStatus: query.paymentStatus }),
      },
    }),
  };
  const [items, total] = await prismaC.$transaction([
    prismaC.orderItem.findMany({
      where: itemWhere, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: [{ gameTopUpOrderDetail: { queueDate: "asc" } }, { gameTopUpOrderDetail: { dailySerial: "asc" } }, { createdAt: "asc" }],
      select: {
        id: true, productTitle: true, optionTitle: true, customerInputs: true, deliveryStatus: true, createdAt: true,
        gameTopUpProductId: true,
        gameTopUpOrderDetail: {
          select: {
            id: true, queueDate: true, dailySerial: true, cancellableUntil: true,
            processingStartedAt: true, gameCurrencyAmountSnapshot: true,
            bonusCurrencyAmountSnapshot: true, gameCurrencyLabelSnapshot: true,
          },
        },
        order: { select: { id: true, orderNumber: true, paymentStatus: true, user: { select: { id: true, name: true, email: true } } } },
      },
    }),
    prismaC.orderItem.count({ where: itemWhere }),
  ]);
  return {
    data: items.map((item) => ({ ...item, status: apiStatus(item.deliveryStatus), customerInputs: undefined, accountDetails: maskAccountDetails(item.customerInputs) })),
    meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
  };
};

const getForAdmin = async (adminId: string, orderId: string) => {
  const order = await prismaC.order.findFirst({
    where: { id: orderId, items: { some: { productType: DigitalProductType.GAME_TOP_UP } } },
    include: { user: { select: { id: true, name: true, email: true, phone: true } }, items: { where: { productType: DigitalProductType.GAME_TOP_UP }, include: { gameTopUpOrderDetail: { include: { processedByAdmin: { select: { id: true, name: true } }, completedByAdmin: { select: { id: true, name: true } } } } } } },
  });
  if (!order) throw gameTopUpError(404, "ORDER_NOT_FOUND", "Top-up order not found");
  return {
    ...order,
    items: order.items.map((item) => {
      const canReveal = item.deliveryStatus === DeliveryStatus.PROCESSING && item.gameTopUpOrderDetail?.processedByAdminId === adminId;
      return {
        ...item,
        customerInputs: canReveal ? item.customerInputs : undefined,
        accountDetails: canReveal ? item.customerInputs : maskAccountDetails(item.customerInputs),
      };
    }),
  };
};

const startProcessing = async (adminId: string, orderId: string, now = new Date()) => {
  await prismaC.$transaction(async (tx) => {
    const item = await tx.orderItem.findFirst({ where: { orderId, productType: DigitalProductType.GAME_TOP_UP, order: { paymentStatus: PaymentStatus.PAID }, gameTopUpOrderDetail: { is: { queueDate: { not: null } } } }, select: { id: true } });
    if (!item) throw gameTopUpError(404, "ORDER_NOT_FOUND", "Paid queued top-up order not found");
    const changed = await tx.orderItem.updateMany({ where: { id: item.id, deliveryStatus: DeliveryStatus.PENDING }, data: { deliveryStatus: DeliveryStatus.PROCESSING } });
    if (changed.count !== 1) throw gameTopUpError(409, "ORDER_CLAIM_CONFLICT", "This order was already claimed or cancelled");
    await tx.gameTopUpOrderDetail.update({ where: { orderItemId: item.id }, data: { processingStartedAt: now, processedByAdminId: adminId } });
    await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.PROCESSING } });
    await tx.auditLog.create({ data: { actorId: adminId, action: "ORDER_PROCESSING_STARTED", entityType: "GameTopUpOrder", entityId: orderId } });
  });
  return getForAdmin(adminId, orderId);
};

const complete = async (adminId: string, orderId: string, input: CompleteTopUpOrderInput, now = new Date()) => prismaC.$transaction(async (tx) => {
  const item = await tx.orderItem.findFirst({ where: { orderId, productType: DigitalProductType.GAME_TOP_UP }, select: { id: true } });
  if (!item) throw gameTopUpError(404, "ORDER_NOT_FOUND", "Top-up order not found");
  const changed = await tx.orderItem.updateMany({
    where: {
      id: item.id,
      deliveryStatus: DeliveryStatus.PROCESSING,
      gameTopUpOrderDetail: { is: { processedByAdminId: adminId } },
    },
    data: { deliveryStatus: DeliveryStatus.DELIVERED, fulfilledAt: now },
  });
  if (changed.count !== 1) throw gameTopUpError(409, "INVALID_STATUS_TRANSITION", "Only the admin who claimed a processing order can complete it");
  await tx.gameTopUpOrderDetail.update({ where: { orderItemId: item.id }, data: { previousBalance: input.previousBalance, currentBalance: input.currentBalance, customerMessage: input.customerMessage ?? "Your top-up has been completed. Please log in and verify your balance.", internalAdminNote: input.internalAdminNote, completedAt: now, completedByAdminId: adminId } });
  await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.COMPLETED } });
  await tx.auditLog.create({ data: { actorId: adminId, action: "ORDER_COMPLETED", entityType: "GameTopUpOrder", entityId: orderId } });
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: { select: { email: true, name: true } }, items: { where: { productType: DigitalProductType.GAME_TOP_UP }, include: { gameTopUpOrderDetail: true } } } });
});

const fail = async (adminId: string, orderId: string, input: FailTopUpOrderInput, now = new Date()) => prismaC.$transaction(async (tx) => {
  const item = await tx.orderItem.findFirst({ where: { orderId, productType: DigitalProductType.GAME_TOP_UP }, select: { id: true } });
  if (!item) throw gameTopUpError(404, "ORDER_NOT_FOUND", "Top-up order not found");
  const changed = await tx.orderItem.updateMany({
    where: {
      id: item.id,
      deliveryStatus: DeliveryStatus.PROCESSING,
      gameTopUpOrderDetail: { is: { processedByAdminId: adminId } },
    },
    data: { deliveryStatus: DeliveryStatus.FAILED, failureReason: input.customerMessage },
  });
  if (changed.count !== 1) throw gameTopUpError(409, "INVALID_STATUS_TRANSITION", "Only the admin who claimed a processing order can fail it");
  await tx.gameTopUpOrderDetail.update({ where: { orderItemId: item.id }, data: { failedAt: now, failureReason: input.reason, customerMessage: input.customerMessage, internalAdminNote: input.internalAdminNote } });
  await tx.auditLog.create({ data: { actorId: adminId, action: "ORDER_FAILED", entityType: "GameTopUpOrder", entityId: orderId, metadata: { reason: input.reason } } });
  return { orderId, status: "FAILED", failedAt: now, customerMessage: input.customerMessage };
});

export const gameTopUpOrderService = {
  createOrder, listForCustomer, getForCustomer, cancel,
  listForAdmin, getForAdmin, startProcessing, complete, fail,
};
