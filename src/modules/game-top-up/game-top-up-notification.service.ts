import { DeliveryStatus, DigitalProductType, OrderStatus, PaymentStatus } from "../../generated/prisma/client";
import { ENV } from "../../utils/env-config";
import { logger } from "../../utils/logger";
import { prismaC } from "../../utils/prisma-client";
import { topUpEmailProvider, topUpEmailProviderName } from "./providers/email-provider.factory";

const notifyOrderCompletion = async (orderId: string) => {
  const retryBefore = new Date(Date.now() - ENV.TOP_UP_EMAIL_RETRY_MINUTES * 60_000);
  const order = await prismaC.order.findFirst({
    where: { id: orderId, status: OrderStatus.COMPLETED, paymentStatus: PaymentStatus.PAID },
    include: {
      user: { select: { email: true, name: true } },
      items: { where: { productType: DigitalProductType.GAME_TOP_UP, deliveryStatus: DeliveryStatus.DELIVERED }, include: { gameTopUpOrderDetail: true } },
    },
  });
  const item = order?.items[0];
  const detail = item?.gameTopUpOrderDetail;
  if (!order || !item || !detail?.completedAt || detail.notificationSentAt) return { notified: false, skipped: true };

  const claimed = await prismaC.gameTopUpOrderDetail.updateMany({
    where: {
      id: detail.id, notificationSentAt: null,
      notificationAttempts: { lt: ENV.TOP_UP_EMAIL_MAX_ATTEMPTS },
      OR: [{ notificationLastAttemptAt: null }, { notificationLastAttemptAt: { lte: retryBefore } }],
    },
    data: { notificationAttempts: { increment: 1 }, notificationLastAttemptAt: new Date(), notificationFailure: null },
  });
  if (claimed.count !== 1) return { notified: false, skipped: true };

  try {
    await topUpEmailProvider.sendTopUpCompleted({
      to: order.user.email, customerName: order.user.name, orderNumber: order.orderNumber,
      game: item.productTitle, packageName: item.optionTitle ?? item.productTitle,
      dailySerial: detail.dailySerial, completedAt: detail.completedAt,
    });
    await prismaC.gameTopUpOrderDetail.update({ where: { id: detail.id }, data: { notificationSentAt: new Date(), notificationFailure: null } });
    await prismaC.auditLog.create({ data: { action: "TOP_UP_NOTIFICATION_SENT", entityType: "GameTopUpOrder", entityId: order.id, metadata: { provider: topUpEmailProviderName } } });
    return { notified: true, skipped: false };
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownProviderError";
    logger.warn({ orderId: order.id, provider: topUpEmailProviderName, errorType }, "Top-up completion notification failed");
    await prismaC.gameTopUpOrderDetail.update({ where: { id: detail.id }, data: { notificationFailure: "Email provider failed" } }).catch((updateError) => {
      logger.error({ orderId: order.id, error: updateError }, "Failed to record top-up notification result");
    });
    return { notified: false, skipped: false };
  }
};

const retryTopUpNotifications = async (limit = 20) => {
  const retryBefore = new Date(Date.now() - ENV.TOP_UP_EMAIL_RETRY_MINUTES * 60_000);
  const orders = await prismaC.order.findMany({
    where: {
      status: OrderStatus.COMPLETED, paymentStatus: PaymentStatus.PAID,
      items: { some: {
        productType: DigitalProductType.GAME_TOP_UP, deliveryStatus: DeliveryStatus.DELIVERED,
        gameTopUpOrderDetail: { is: {
          notificationSentAt: null, notificationAttempts: { lt: ENV.TOP_UP_EMAIL_MAX_ATTEMPTS },
          OR: [{ notificationLastAttemptAt: null }, { notificationLastAttemptAt: { lte: retryBefore } }],
        } },
      } },
    },
    select: { id: true }, take: limit, orderBy: { updatedAt: "asc" },
  });
  for (const order of orders) await notifyOrderCompletion(order.id);
  return orders.length;
};

const notifyCompletion = (order: { id: string }) => notifyOrderCompletion(order.id);

export const gameTopUpNotificationService = { notifyCompletion, notifyOrderCompletion, retryTopUpNotifications };
