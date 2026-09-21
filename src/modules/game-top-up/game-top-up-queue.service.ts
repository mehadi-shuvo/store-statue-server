import { DeliveryStatus, PaymentStatus, Prisma } from "../../generated/prisma/client";
import { ENV } from "../../utils/env-config";

type SequenceRow = { queueDate: Date; lastSerial: number };

export const getQueueDateKey = (now = new Date(), timeZone = ENV.TOP_UP_QUEUE_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

export const assignQueueToPaidTopUpOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  now = new Date(),
) => {
  const pending = await tx.gameTopUpOrderDetail.findMany({
    where: {
      queueDate: null,
      orderItem: {
        orderId,
        deliveryStatus: DeliveryStatus.PENDING,
        order: { paymentStatus: PaymentStatus.PAID },
      },
    },
    select: { id: true, orderItemId: true },
    orderBy: { createdAt: "asc" },
  });
  const assigned: Array<{ orderItemId: string; queueDate: string; dailySerial: number }> = [];

  for (const detail of pending) {
    const queueDate = getQueueDateKey(now);
    const rows = await tx.$queryRaw<SequenceRow[]>(Prisma.sql`
      INSERT INTO "daily_game_top_up_sequences" ("queueDate", "lastSerial", "createdAt", "updatedAt")
      VALUES (CAST(${queueDate} AS date), 1, ${now}, ${now})
      ON CONFLICT ("queueDate") DO UPDATE
      SET "lastSerial" = "daily_game_top_up_sequences"."lastSerial" + 1,
          "updatedAt" = EXCLUDED."updatedAt"
      RETURNING "queueDate", "lastSerial"
    `);
    const sequence = rows[0];
    await tx.gameTopUpOrderDetail.update({
      where: { id: detail.id },
      data: {
        queueDate: sequence.queueDate,
        dailySerial: sequence.lastSerial,
        cancellableUntil: new Date(now.getTime() + ENV.TOP_UP_CANCELLATION_WINDOW_SECONDS * 1000),
      },
    });
    await tx.auditLog.create({
      data: {
        action: "TOPUP_QUEUED",
        entityType: "GameTopUpOrder",
        entityId: orderId,
        metadata: { orderItemId: detail.orderItemId, queueDate, dailySerial: sequence.lastSerial },
      },
    });
    assigned.push({ orderItemId: detail.orderItemId, queueDate, dailySerial: sequence.lastSerial });
  }
  return assigned;
};
