import { DeliveryStatus, DigitalProductType, OrderStatus, PaymentStatus, Prisma } from "../../generated/prisma/client";
import { ENV } from "../../utils/env-config";
import { logger } from "../../utils/logger";
import { prismaC } from "../../utils/prisma-client";
import { gameTopUpNotificationService } from "./game-top-up-notification.service";
import { getGameTopUpProvider } from "./providers/game-top-up-provider.factory";
import { GameTopUpProviderError, type GameTopUpProviderRequest, type GameTopUpProviderResult } from "./providers/game-top-up-provider.interface";

type ClaimedItem = GameTopUpProviderRequest & {
  orderItemId: string;
  attempt: number;
  operation: "SUBMIT" | "QUERY";
  providerOrderId: string | null;
};

const stringAccountDetails = (value: Prisma.JsonValue | null): Record<string, string> => {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value)
    .filter((entry): entry is [string, string | number | boolean] => ["string", "number", "boolean"].includes(typeof entry[1]))
    .map(([key, entryValue]) => [key, String(entryValue)]));
};

const retryAt = (attempt: number) => {
  const seconds = ENV.TOP_UP_RETRY_BACKOFF_SECONDS[Math.min(Math.max(attempt - 1, 0), ENV.TOP_UP_RETRY_BACKOFF_SECONDS.length - 1)];
  return new Date(Date.now() + seconds * 1_000);
};

const providerReference = (value: Prisma.JsonValue | null) => {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return typeof value.providerOrderId === "string" ? value.providerOrderId : null;
};

const claimItem = async (orderItemId: string, providerName: string): Promise<ClaimedItem | null> =>
  prismaC.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "order_items" WHERE "id" = ${orderItemId} FOR UPDATE`);
    const item = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      select: {
        id: true, orderId: true, deliveryStatus: true, customerInputs: true,
        fulfillmentReference: true, fulfillmentData: true,
        order: { select: { paymentStatus: true } },
        gameTopUpProduct: { select: { slug: true } },
        gameTopUpOrderDetail: { select: {
          fulfillmentKey: true, providerProductIdSnapshot: true, providerAttempts: true,
          nextRetryAt: true, processingStartedAt: true, processedByAdminId: true,
        } },
      },
    });
    const detail = item?.gameTopUpOrderDetail;
    if (!item || !detail || !item.gameTopUpProduct || item.order.paymentStatus !== PaymentStatus.PAID || detail.processedByAdminId) return null;

    const now = new Date();
    const staleBefore = new Date(now.getTime() - ENV.TOP_UP_PROCESSING_STALE_SECONDS * 1_000);
    const dueRetry = !detail.nextRetryAt || detail.nextRetryAt <= now;
    const initial = ([DeliveryStatus.PENDING, DeliveryStatus.QUEUED] as DeliveryStatus[]).includes(item.deliveryStatus);
    const retryable = item.deliveryStatus === DeliveryStatus.FAILED_RETRYABLE && dueRetry;
    const uncertain = item.deliveryStatus === DeliveryStatus.PROVIDER_PENDING && dueRetry;
    const stale = item.deliveryStatus === DeliveryStatus.PROCESSING && !!detail.processingStartedAt && detail.processingStartedAt <= staleBefore;
    if (!initial && !retryable && !uncertain && !stale) return null;

    const operation: ClaimedItem["operation"] = uncertain || stale ? "QUERY" : "SUBMIT";
    const attempt = detail.providerAttempts + 1;
    const existingProviderOrderId = item.fulfillmentReference ?? providerReference(item.fulfillmentData);
    await tx.orderItem.update({ where: { id: item.id }, data: {
      deliveryStatus: DeliveryStatus.PROCESSING,
      fulfillmentData: { provider: providerName, status: "PROCESSING", operation, idempotencyKey: detail.fulfillmentKey, providerOrderId: existingProviderOrderId },
    } });
    await tx.gameTopUpOrderDetail.update({ where: { orderItemId: item.id }, data: {
      providerAttempts: { increment: 1 }, lastProviderAttemptAt: now,
      processingStartedAt: now, nextRetryAt: retryAt(attempt), failureReason: null,
    } });
    await tx.order.update({ where: { id: item.orderId }, data: { status: OrderStatus.PROCESSING } });
    await tx.auditLog.create({ data: {
      action: operation === "QUERY" ? "TOPUP_PROVIDER_STATUS_QUERIED" : "TOPUP_SUBMITTED",
      entityType: "GameTopUpOrder", entityId: item.orderId,
      metadata: { orderItemId: item.id, provider: providerName, attempt, idempotencyKey: detail.fulfillmentKey },
    } });
    return {
      orderItemId: item.id, orderId: item.orderId, idempotencyKey: detail.fulfillmentKey,
      gameCode: item.gameTopUpProduct.slug, packageCode: detail.providerProductIdSnapshot ?? "UNMAPPED",
      accountDetails: stringAccountDetails(item.customerInputs), attempt, operation,
      providerOrderId: existingProviderOrderId,
    };
  });

const settleItem = async (item: ClaimedItem, providerName: string, result: GameTopUpProviderResult | null, error?: unknown) => {
  const now = new Date();
  const unknown = result?.status === "PENDING" || (error instanceof GameTopUpProviderError ? error.statusUnknown : error !== undefined);
  const retryable = unknown || (result?.status === "FAILED" && result.retryable === true) || (error instanceof GameTopUpProviderError && error.retryable);
  const exhausted = item.attempt >= ENV.TOP_UP_MAX_PROVIDER_ATTEMPTS;
  const success = result?.status === "SUCCESS";
  const finalStatus = success ? DeliveryStatus.DELIVERED
    : exhausted ? DeliveryStatus.MANUAL_REVIEW
      : unknown ? DeliveryStatus.PROVIDER_PENDING
        : retryable ? DeliveryStatus.FAILED_RETRYABLE : DeliveryStatus.FAILED_FINAL;
  const message = result?.message ?? (unknown ? "The provider result is still pending confirmation." : "The top-up provider request could not be completed.");

  return prismaC.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "order_items" WHERE "id" = ${item.orderItemId} FOR UPDATE`);
    const changed = await tx.orderItem.updateMany({
      where: { id: item.orderItemId, deliveryStatus: DeliveryStatus.PROCESSING, order: { paymentStatus: PaymentStatus.PAID } },
      data: {
        deliveryStatus: finalStatus,
        fulfillmentReference: result?.providerOrderId ?? item.providerOrderId,
        fulfillmentData: {
          provider: providerName, status: result?.status ?? (unknown ? "PENDING" : "FAILED"),
          operation: item.operation, idempotencyKey: item.idempotencyKey,
          providerOrderId: result?.providerOrderId ?? item.providerOrderId,
          ...(result?.status === "FAILED" ? { failureCode: result.failureCode } : {}),
        },
        failureReason: success ? null : message,
        fulfilledAt: success ? now : undefined,
      },
    });
    if (changed.count !== 1) return false;
    await tx.gameTopUpOrderDetail.update({ where: { orderItemId: item.orderItemId }, data: {
      completedAt: success ? now : undefined,
      failedAt: !success && !unknown ? now : undefined,
      failureReason: success ? null : result?.status === "FAILED" ? result.failureCode : error instanceof Error ? error.name : "PROVIDER_STATUS_UNKNOWN",
      customerMessage: message,
      nextRetryAt: success || ([DeliveryStatus.FAILED_FINAL, DeliveryStatus.MANUAL_REVIEW] as DeliveryStatus[]).includes(finalStatus) ? null : retryAt(item.attempt),
      manualReviewAt: finalStatus === DeliveryStatus.MANUAL_REVIEW ? now : null,
    } });
    if (success) {
      const unfinished = await tx.orderItem.count({ where: { orderId: item.orderId, productType: DigitalProductType.GAME_TOP_UP, deliveryStatus: { not: DeliveryStatus.DELIVERED } } });
      if (unfinished === 0) await tx.order.update({ where: { id: item.orderId }, data: { status: OrderStatus.COMPLETED, completedAt: now } });
    } else if (([DeliveryStatus.MANUAL_REVIEW, DeliveryStatus.FAILED_FINAL] as DeliveryStatus[]).includes(finalStatus)) {
      await tx.order.update({ where: { id: item.orderId }, data: { status: OrderStatus.MANUAL_REVIEW } });
    }
    await tx.auditLog.create({ data: {
      action: success ? "TOPUP_PROVIDER_CONFIRMED" : finalStatus === DeliveryStatus.MANUAL_REVIEW ? "MANUAL_REVIEW_REQUIRED" : "TOPUP_FAILED",
      entityType: "GameTopUpOrder", entityId: item.orderId,
      metadata: { orderItemId: item.orderItemId, provider: providerName, attempt: item.attempt, status: finalStatus },
    } });
    return true;
  });
};

const processItem = async (orderItemId: string) => {
  const provider = getGameTopUpProvider();
  const item = await claimItem(orderItemId, provider.name);
  if (!item) return null;
  let result: GameTopUpProviderResult | null = null;
  let caught: unknown;
  try {
    if (item.operation === "QUERY") {
      if (!provider.queryTopUp) throw new GameTopUpProviderError("Provider status query is unavailable.", false, true);
      result = await provider.queryTopUp({ idempotencyKey: item.idempotencyKey, orderId: item.orderId, providerOrderId: item.providerOrderId });
    } else result = await provider.topUp(item);
  } catch (error) {
    caught = error;
    logger.warn({ orderId: item.orderId, orderItemId, provider: provider.name, errorType: error instanceof Error ? error.name : "UnknownProviderError" }, "Game top-up provider operation deferred");
  }
  const settled = await settleItem(item, provider.name, result, caught);
  if (settled && result?.status === "SUCCESS") await gameTopUpNotificationService.notifyOrderCompletion(item.orderId);
  return { orderItemId, status: result?.status ?? "DEFERRED" };
};

export const fulfillPaidGameTopUpOrder = async (orderId: string) => {
  const items = await prismaC.orderItem.findMany({ where: {
    orderId, productType: DigitalProductType.GAME_TOP_UP,
    deliveryStatus: { in: [DeliveryStatus.PENDING, DeliveryStatus.QUEUED] }, order: { paymentStatus: PaymentStatus.PAID },
  }, select: { id: true } });
  const outcomes: Array<{ orderItemId: string; status: string }> = [];
  for (const item of items) {
    const outcome = await processItem(item.id);
    if (outcome) outcomes.push(outcome);
  }
  return { handled: outcomes.length > 0, outcomes };
};

export const retryGameTopUpFulfillments = async (limit = 20) => {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - ENV.TOP_UP_PROCESSING_STALE_SECONDS * 1_000);
  const items = await prismaC.orderItem.findMany({ where: {
    productType: DigitalProductType.GAME_TOP_UP, order: { paymentStatus: PaymentStatus.PAID },
    gameTopUpOrderDetail: { is: { providerAttempts: { lt: ENV.TOP_UP_MAX_PROVIDER_ATTEMPTS }, processedByAdminId: null } },
    OR: [
      { deliveryStatus: { in: [DeliveryStatus.PENDING, DeliveryStatus.QUEUED] } },
      { deliveryStatus: { in: [DeliveryStatus.FAILED_RETRYABLE, DeliveryStatus.PROVIDER_PENDING] }, gameTopUpOrderDetail: { is: { nextRetryAt: { lte: now } } } },
      { deliveryStatus: DeliveryStatus.PROCESSING, gameTopUpOrderDetail: { is: { processingStartedAt: { lte: staleBefore } } } },
    ],
  }, select: { id: true }, take: limit, orderBy: { updatedAt: "asc" } });
  for (const item of items) await processItem(item.id);
  return items.length;
};
