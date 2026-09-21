import {
  DeliveryStatus,
  DigitalProductType,
  GiftCardCodeStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from "../../generated/prisma/client";
import { logger } from "../../utils/logger";
import { prismaC } from "../../utils/prisma-client";
import { sendEmail, type EmailSender } from "../../utils/sendEmail";
import { ENV } from "../../utils/env-config";
import { giftCardDeliveryTemplate } from "../../utils/email-templates";
import { decryptGiftCardSecret } from "./gift-card-crypto";
import { giftCardError } from "./gift-card.errors";
import { moneyString } from "./gift-card.utils";

export const giftCardEmailSender: EmailSender = { send: sendEmail };

export class LateGiftCardInventoryUnavailableError extends Error {}

export const reserveGiftCardInventoryForLatePayment = async (
  tx: Prisma.TransactionClient,
  orderId: string,
) => {
  const items = await tx.orderItem.findMany({
    where: { orderId, productType: DigitalProductType.GIFT_CARD },
    select: {
      id: true,
      quantity: true,
      giftCardDenominationId: true,
      assignedGiftCardCodes: {
        where: { status: { in: [GiftCardCodeStatus.RESERVED, GiftCardCodeStatus.SOLD] } },
        select: { id: true },
      },
    },
  });
  if (!items.length) return false;

  for (const item of items) {
    if (item.assignedGiftCardCodes.length === item.quantity) continue;
    if (!item.giftCardDenominationId || item.assignedGiftCardCodes.length) {
      throw new LateGiftCardInventoryUnavailableError();
    }
    const codes = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "gift_card_codes"
      WHERE "denominationId" = ${item.giftCardDenominationId}
        AND "status" = 'AVAILABLE'::"GiftCardCodeStatus"
        AND ("expiryDate" IS NULL OR "expiryDate" > NOW())
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${item.quantity}
    `);
    if (codes.length !== item.quantity) {
      throw new LateGiftCardInventoryUnavailableError();
    }
    const changed = await tx.giftCardCode.updateMany({
      where: {
        id: { in: codes.map((code) => code.id) },
        status: GiftCardCodeStatus.AVAILABLE,
        orderItemId: null,
      },
      data: {
        status: GiftCardCodeStatus.RESERVED,
        orderItemId: item.id,
        reservedAt: new Date(),
        reservationExpiresAt: new Date(),
      },
    });
    if (changed.count !== item.quantity) {
      throw new LateGiftCardInventoryUnavailableError();
    }
  }
  return true;
};

export const finalizeGiftCardOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  completedAt: Date,
) => {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      deliveryEmail: true,
      items: {
        where: { productType: DigitalProductType.GIFT_CARD },
        select: {
          id: true,
          quantity: true,
          productTitle: true,
          brandSnapshot: true,
          faceValueSnapshot: true,
          faceCurrencySnapshot: true,
          assignedGiftCardCodes: {
            where: { status: GiftCardCodeStatus.RESERVED },
            select: { id: true, expiryDate: true },
          },
        },
      },
    },
  });
  if (!order?.items.length) return false;
  if (!order.deliveryEmail) {
    throw giftCardError(409, "DELIVERY_EMAIL_REQUIRED", "Gift-card order has no delivery email");
  }

  for (const item of order.items) {
    if (item.assignedGiftCardCodes.length !== item.quantity) {
      throw giftCardError(409, "RESERVATION_NOT_AVAILABLE", "Reserved gift-card inventory is no longer available");
    }
    const codeIds = item.assignedGiftCardCodes.map((code) => code.id);
    const sold = await tx.giftCardCode.updateMany({
      where: { id: { in: codeIds }, status: GiftCardCodeStatus.RESERVED, orderItemId: item.id },
      data: {
        status: GiftCardCodeStatus.SOLD,
        soldAt: completedAt,
        reservedAt: null,
        reservationExpiresAt: null,
      },
    });
    if (sold.count !== item.quantity) {
      throw giftCardError(409, "RESERVATION_CONFLICT", "Gift-card inventory changed during payment completion");
    }
    await tx.giftCardDelivery.createMany({
      data: item.assignedGiftCardCodes.map((code) => ({
        orderItemId: item.id,
        inventoryCodeId: code.id,
        cardNameSnapshot: item.productTitle,
        brandSnapshot: item.brandSnapshot || item.productTitle,
        faceValueSnapshot: item.faceValueSnapshot || new Prisma.Decimal(0),
        currencySnapshot: item.faceCurrencySnapshot || "USD",
        expiryDateSnapshot: code.expiryDate,
        deliveryEmail: order.deliveryEmail!,
        deliveryStatus: DeliveryStatus.PENDING,
      })),
      skipDuplicates: true,
    });
    await tx.orderItem.update({
      where: { id: item.id },
      data: { deliveryStatus: DeliveryStatus.PENDING, fulfilledAt: completedAt },
    });
  }
  await tx.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.COMPLETED, completedAt },
  });
  await tx.auditLog.create({ data: {
    action: "GIFT_CARD_FULFILLED", entityType: "Order", entityId: order.id,
    metadata: { deliveryCount: order.items.reduce((count, item) => count + item.quantity, 0) },
  } });
  return true;
};

export const releaseGiftCardReservation = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  status: PaymentStatus,
  reason: string,
) => {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { paymentStatus: true, items: { where: { productType: DigitalProductType.GIFT_CARD }, select: { id: true } } },
  });
  if (!order?.items.length || order.paymentStatus === PaymentStatus.PAID) return false;
  const itemIds = order.items.map((item) => item.id);
  await tx.giftCardCode.updateMany({
    where: { orderItemId: { in: itemIds }, status: GiftCardCodeStatus.RESERVED },
    data: { status: GiftCardCodeStatus.AVAILABLE, orderItemId: null, reservedAt: null, reservationExpiresAt: null },
  });
  await tx.orderItem.updateMany({
    where: { id: { in: itemIds }, deliveryStatus: { in: [DeliveryStatus.PENDING, DeliveryStatus.PROCESSING] } },
    data: { deliveryStatus: DeliveryStatus.CANCELLED, failureReason: reason },
  });
  await tx.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CANCELLED, paymentStatus: status },
  });
  await tx.auditLog.create({ data: {
    action: "INVENTORY_RELEASED", entityType: "Order", entityId: orderId,
    metadata: { paymentStatus: status, reason },
  } });
  return true;
};

export const deliverGiftCardOrder = async (orderId: string) => {
  const retryBefore = new Date(Date.now() - ENV.GIFT_CARD_EMAIL_RETRY_MINUTES * 60_000);
  const claimable = {
    emailAttempts: { lt: ENV.GIFT_CARD_EMAIL_MAX_ATTEMPTS },
    OR: [
      { deliveryStatus: DeliveryStatus.PENDING },
      { deliveryStatus: DeliveryStatus.FAILED, emailLastAttemptAt: { lte: retryBefore } },
      { deliveryStatus: DeliveryStatus.PROCESSING, emailLastAttemptAt: { lte: retryBefore } },
    ],
  } satisfies Prisma.GiftCardDeliveryWhereInput;
  const claimed = await prismaC.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, status: OrderStatus.COMPLETED, paymentStatus: PaymentStatus.PAID },
      select: {
        id: true,
        orderNumber: true,
        deliveryEmail: true,
        payment: { select: { transactionId: true } },
        items: {
          where: { productType: DigitalProductType.GIFT_CARD },
          select: {
            productTitle: true,
            giftCardDeliveries: {
              where: claimable,
              select: {
                id: true,
                brandSnapshot: true,
                faceValueSnapshot: true,
                currencySnapshot: true,
                expiryDateSnapshot: true,
                inventoryCode: { select: { code: true, pin: true, status: true } },
              },
            },
          },
        },
      },
    });
    if (!order?.deliveryEmail) return null;
    const deliveries = order.items.flatMap((item) =>
      item.giftCardDeliveries.map((delivery) => ({ ...delivery, productTitle: item.productTitle })),
    );
    if (!deliveries.length || deliveries.some((item) => item.inventoryCode.status !== GiftCardCodeStatus.SOLD)) return null;
    const ids = deliveries.map((delivery) => delivery.id);
    const changed = await tx.giftCardDelivery.updateMany({
      where: { id: { in: ids }, ...claimable },
      data: { deliveryStatus: DeliveryStatus.PROCESSING, emailLastAttemptAt: new Date(), emailAttempts: { increment: 1 }, failureReason: null },
    });
    if (changed.count !== ids.length) return null;
    return { ...order, deliveries };
  });
  if (!claimed) return { delivered: false, skipped: true };

  const template = giftCardDeliveryTemplate({
    orderNumber: claimed.orderNumber,
    transactionId: claimed.payment?.transactionId || "N/A",
    items: claimed.deliveries.map((delivery) => ({
      product: delivery.productTitle,
      brand: delivery.brandSnapshot,
      value: moneyString(delivery.faceValueSnapshot),
      currency: delivery.currencySnapshot,
      code: decryptGiftCardSecret(delivery.inventoryCode.code) || "N/A",
      pin: decryptGiftCardSecret(delivery.inventoryCode.pin) || "N/A",
      expiry: delivery.expiryDateSnapshot?.toISOString().slice(0, 10) || "N/A",
    })),
  });

  try {
    await giftCardEmailSender.send({ to: claimed.deliveryEmail!, ...template });
    const deliveredAt = new Date();
    await prismaC.giftCardDelivery.updateMany({
      where: { id: { in: claimed.deliveries.map((delivery) => delivery.id) }, deliveryStatus: DeliveryStatus.PROCESSING },
      data: { deliveryStatus: DeliveryStatus.DELIVERED, deliveredAt, failureReason: null },
    });
    await prismaC.orderItem.updateMany({
      where: { orderId, productType: DigitalProductType.GIFT_CARD },
      data: { deliveryStatus: DeliveryStatus.DELIVERED, failureReason: null },
    });
    logger.info({ orderId }, "Gift-card email delivered");
    return { delivered: true, skipped: false };
  } catch (error) {
    await prismaC.giftCardDelivery.updateMany({
      where: { id: { in: claimed.deliveries.map((delivery) => delivery.id) }, deliveryStatus: DeliveryStatus.PROCESSING },
      data: { deliveryStatus: DeliveryStatus.FAILED, failureReason: "Email delivery failed" },
    });
    await prismaC.orderItem.updateMany({
      where: { orderId, productType: DigitalProductType.GIFT_CARD },
      data: { deliveryStatus: DeliveryStatus.FAILED, failureReason: "Email delivery failed" },
    });
    logger.warn({ orderId, error }, "Gift-card email delivery failed");
    return { delivered: false, skipped: false };
  }
};

export const retryGiftCardDeliveries = async (limit = 20) => {
  const retryBefore = new Date(Date.now() - ENV.GIFT_CARD_EMAIL_RETRY_MINUTES * 60_000);
  const orders = await prismaC.order.findMany({
    where: {
      status: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      items: {
        some: {
          giftCardDeliveries: {
            some: {
              emailAttempts: { lt: ENV.GIFT_CARD_EMAIL_MAX_ATTEMPTS },
              OR: [
                { deliveryStatus: DeliveryStatus.PENDING },
                { deliveryStatus: DeliveryStatus.FAILED, emailLastAttemptAt: { lte: retryBefore } },
                { deliveryStatus: DeliveryStatus.PROCESSING, emailLastAttemptAt: { lte: retryBefore } },
              ],
            },
          },
        },
      },
    },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });
  for (const order of orders) await deliverGiftCardOrder(order.id);
  return orders.length;
};
