import { OrderStatus, PaymentMethod, PaymentStatus, Prisma, type Payment } from "../../../generated/prisma/client";
import { ApiAppError } from "../../../utils/apiAppError";
import { logger } from "../../../utils/logger";
import { prismaC } from "../../../utils/prisma-client";
import { deliverGiftCardOrder, finalizeGiftCardOrder, LateGiftCardInventoryUnavailableError, releaseGiftCardReservation, reserveGiftCardInventoryForLatePayment, retryGiftCardDeliveries } from "../../gift-card/gift-card-fulfillment.service";
import { fulfillPaidGameTopUpOrder } from "../../game-top-up/game-top-up-fulfillment.service";
import { assignQueueToPaidTopUpOrder } from "../../game-top-up/game-top-up-queue.service";
import type { IPaymentProvider } from "../interfaces/payment-provider.interface";
import type { CallbackOutcome, ProviderQueryPaymentResponse } from "../types/payment.types";
import { PaymentProviderError } from "../utils/payment-provider-error";
import { createTransactionId, isRecord } from "../utils/payment.utils";
import { assertPaymentIdentity, assertVerifiedPayment } from "../utils/payment-verification";
import type { CreatePaymentPayload } from "../validators/payment.validation";
import { assertPaymentTransition, paymentNeedsReconciliation } from "./payment-state-machine";
import { markRefundPending } from "./refund.service";

const payableStatuses: PaymentStatus[] = [PaymentStatus.CREATED, PaymentStatus.PENDING, PaymentStatus.INITIATED, PaymentStatus.PROCESSING, PaymentStatus.UNKNOWN];
type PaymentWithOrder = Payment & { order: { id: string; userId: string; totalCost: Prisma.Decimal } };
const orderSelection = { id: true, userId: true, totalCost: true } as const;

export class PaymentService {
  constructor(private readonly provider: IPaymentProvider) {}

  async createPayment(payload: CreatePaymentPayload, userId: string) {
    // Serialize initiation before contacting the gateway: only one caller creates a session.
    const claimed = await prismaC.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${payload.orderId} AND "userId" = ${userId} FOR UPDATE`);
      const order = await tx.order.findFirst({
        where: { id: payload.orderId, userId },
        include: { payment: true, address: true, items: { select: { id: true } }, user: { select: { name: true, email: true, phone: true, addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }], take: 1 } } } },
      });
      if (!order) throw new ApiAppError(404, "Order not found");
      if (order.status !== OrderStatus.PENDING || !payableStatuses.includes(order.paymentStatus)) throw new ApiAppError(409, "Order can no longer start payment");
      if (!order.items.length || !order.totalCost.gt(0) || order.currency !== "BDT") throw new ApiAppError(409, "Order has invalid items, amount, or currency");
      if (order.payment) {
        if (order.payment.paymentProvider !== this.provider.name || !payableStatuses.includes(order.payment.paymentStatus)) throw new ApiAppError(409, "Payment can no longer be initiated");
        const response = order.payment.providerResponse;
        if (order.payment.paymentId && isRecord(response) && typeof response.paymentUrl === "string") {
          return { order, payment: order.payment, existingUrl: response.paymentUrl };
        }
        throw new ApiAppError(409, "Payment initiation is already in progress; check payment status", undefined, "PAYMENT_INITIATION_PENDING");
      }
      const transactionId = createTransactionId();
      const payment = await tx.payment.create({ data: {
        orderId: order.id, paymentMethod: PaymentMethod.AAMARPAY, paymentProvider: this.provider.name,
        paymentStatus: PaymentStatus.PROCESSING, paymentId: transactionId, merchantInvoiceNumber: transactionId,
        amount: order.totalCost, currency: order.currency,
        attempts: { create: {
          orderId: order.id, gateway: this.provider.name, merchantTransactionId: transactionId,
          expectedAmount: order.totalCost, currency: order.currency, status: PaymentStatus.PROCESSING,
        } },
      } });
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.PROCESSING } });
      await tx.auditLog.create({ data: {
        actorId: userId, action: "PAYMENT_INITIATED", entityType: "Payment", entityId: payment.id,
        metadata: { orderId: order.id, gateway: this.provider.name, merchantTransactionId: transactionId },
      } });
      return { order, payment, existingUrl: null };
    });
    const { order, payment } = claimed;
    const result = (paymentUrl: string) => ({ orderId: order.id, paymentId: payment.paymentId!, transactionId: payment.paymentId!, paymentUrl });
    if (claimed.existingUrl) return result(claimed.existingUrl);
    try {
      const address = order.address || order.user.addresses[0];
      const response = await this.provider.createPayment({
        orderId: order.id, transactionId: payment.paymentId!, amount: order.totalCost.toFixed(2), currency: order.currency,
        customer: { name: order.user.name, email: order.user.email, phone: order.user.phone, addressLine: address?.addressLine, city: address?.city, country: address?.country, postalCode: address?.postalCode },
      });
      if (response.paymentId !== payment.paymentId) throw new PaymentProviderError("Initiation transaction ID mismatch", this.provider.name);
      await prismaC.payment.updateMany({
        where: { id: payment.id, paymentStatus: PaymentStatus.PROCESSING },
        data: { providerResponse: { paymentUrl: response.paymentUrl }, rawResponse: { paymentUrl: response.paymentUrl } },
      });
      await prismaC.paymentAttempt.updateMany({
        where: { paymentRecordId: payment.id, merchantTransactionId: payment.paymentId! },
        data: { status: PaymentStatus.PROCESSING, gatewayMetadata: { paymentUrl: response.paymentUrl } },
      });
      logger.info({ orderId: order.id, paymentId: payment.paymentId }, "Payment initialized");
      return result(response.paymentUrl);
    } catch (error) {
      if (error instanceof PaymentProviderError && error.details?.rejected === true) {
        await this.failPayment({ ...payment, order }, PaymentStatus.FAILED, "Gateway rejected initiation");
      } else {
        await this.markUnknown(payment.id, payment.orderId, "Payment initiation response was not confirmed");
      }
      // Timeouts are ambiguous. Preserve the durable ID and reserved stock for verification.
      this.handleProviderError(error, "Payment initiation failed; check order status before retrying");
    }
  }

  private async completePayment(payment: PaymentWithOrder, verified: ProviderQueryPaymentResponse) {
    const transactionId = assertVerifiedPayment(verified, payment);
    const completedAt = new Date();
    try {
      const result = await prismaC.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${payment.orderId} FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "payments" WHERE "id" = ${payment.id} FOR UPDATE`);
      const current = await tx.payment.findUnique({ where: { id: payment.id }, include: { order: true } });
      if (!current) throw new ApiAppError(404, "Payment not found");
      assertVerifiedPayment(verified, current);
      if (current.paymentStatus === PaymentStatus.PAID) {
        if (current.transactionId !== transactionId) throw new ApiAppError(409, "Payment was completed with another transaction", undefined, "PAYMENT_TRX_ID_MISMATCH");
        return { transactionId, giftCard: false, idempotent: true, queue: [] };
      }
      const latePayment = ([PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED] as PaymentStatus[]).includes(current.paymentStatus);
      if (!latePayment && (!payableStatuses.includes(current.paymentStatus) || !payableStatuses.includes(current.order.paymentStatus) || current.order.status !== OrderStatus.PENDING)) throw new ApiAppError(409, "Payment or order is no longer payable", undefined, "PAYMENT_TERMINAL");
      if (!current.amount.equals(current.order.totalCost)) throw new ApiAppError(409, "Order amount changed", undefined, "PAYMENT_AMOUNT_MISMATCH");
      const duplicate = await tx.payment.findFirst({ where: { transactionId, id: { not: current.id } }, select: { id: true } });
      if (duplicate) throw new ApiAppError(409, "Gateway transaction was already processed", undefined, "DUPLICATE_TRANSACTION");
      assertPaymentTransition(current.paymentStatus, PaymentStatus.PAID, { lateVerifiedRecovery: latePayment });
      if (latePayment) await reserveGiftCardInventoryForLatePayment(tx, current.orderId);
      await tx.payment.update({ where: { id: current.id }, data: {
        paymentStatus: PaymentStatus.PAID, transactionId, providerPaymentId: transactionId,
        providerResponse: verified.raw as Prisma.InputJsonValue, rawResponse: verified.raw as Prisma.InputJsonValue,
        failureReason: null, reconciliationReason: null, paidAt: completedAt, callbackProcessedAt: completedAt,
      } });
      await tx.paymentAttempt.updateMany({ where: {
        paymentRecordId: current.id, merchantTransactionId: current.paymentId!,
      }, data: {
        status: PaymentStatus.PAID, gatewayTransactionId: transactionId, verifiedAt: completedAt,
        failureReason: null, gatewayMetadata: verified.raw as Prisma.InputJsonValue,
      } });
      await tx.order.update({ where: { id: current.orderId }, data: { paymentStatus: PaymentStatus.PAID } });
      const giftCard = await finalizeGiftCardOrder(tx, current.orderId, completedAt);
      const queue = giftCard ? [] : await assignQueueToPaidTopUpOrder(tx, current.orderId);
      if (!giftCard) await tx.order.update({ where: { id: current.orderId }, data: { status: OrderStatus.CONFIRMED } });
      await tx.auditLog.create({ data: { action: latePayment ? "PAYMENT_RECEIVED_AFTER_EXPIRY" : "PAYMENT_VERIFIED", entityType: "Payment", entityId: current.id, metadata: { orderId: current.orderId, provider: this.provider.name } } });
      return { transactionId, giftCard, idempotent: false, queue };
      });
      await deliverGiftCardOrder(payment.orderId);
      await fulfillPaidGameTopUpOrder(payment.orderId);
      return result;
    } catch (error) {
      if (!(error instanceof LateGiftCardInventoryUnavailableError)) throw error;
      await prismaC.$transaction(async tx => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "payments" WHERE "id" = ${payment.id} FOR UPDATE`);
        const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
        if (current.paymentStatus === PaymentStatus.REFUND_PENDING) return;
        await tx.auditLog.create({ data: {
          action: "PAYMENT_RECEIVED_AFTER_EXPIRY", entityType: "Payment", entityId: current.id,
          metadata: { orderId: current.orderId, provider: this.provider.name, recovery: "INVENTORY_UNAVAILABLE" },
        } });
        await markRefundPending(tx, {
          paymentId: current.id, orderId: current.orderId, gatewayTransactionId: transactionId,
          reason: "Late payment received after reserved inventory was sold",
          metadata: { orderId: current.orderId, provider: this.provider.name, recovery: "INVENTORY_UNAVAILABLE" },
        });
        await tx.paymentAttempt.updateMany({ where: { paymentRecordId: current.id }, data: {
          status: PaymentStatus.REFUND_PENDING, gatewayTransactionId: transactionId,
          verifiedAt: completedAt, gatewayMetadata: verified.raw as Prisma.InputJsonValue,
        } });
      });
      return { transactionId, giftCard: true, idempotent: false, queue: [], refundPending: true };
    }
  }

  private async markUnknown(paymentId: string, orderId: string, reason: string, raw?: Record<string, string | null>) {
    await prismaC.$transaction(async tx => {
      const current = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!current || !paymentNeedsReconciliation(current.paymentStatus)) return;
      if (
        current.paymentStatus === PaymentStatus.UNKNOWN &&
        current.reconciliationReason === reason
      ) return;
      assertPaymentTransition(current.paymentStatus, PaymentStatus.UNKNOWN);
      await tx.payment.update({ where: { id: paymentId }, data: {
        paymentStatus: PaymentStatus.UNKNOWN, reconciliationReason: reason,
        ...(raw ? { providerResponse: raw as Prisma.InputJsonValue, rawResponse: raw as Prisma.InputJsonValue } : {}),
      } });
      await tx.paymentAttempt.updateMany({ where: { paymentRecordId: paymentId, status: { in: payableStatuses } }, data: {
        status: PaymentStatus.UNKNOWN, failureReason: reason,
        ...(raw ? { gatewayMetadata: raw as Prisma.InputJsonValue } : {}),
      } });
      await tx.order.updateMany({ where: { id: orderId, paymentStatus: { in: payableStatuses } }, data: { paymentStatus: PaymentStatus.UNKNOWN } });
      await tx.auditLog.create({ data: { action: "PAYMENT_RECONCILIATION_REQUIRED", entityType: "Payment", entityId: paymentId, metadata: { orderId, reason } } });
    });
  }

  private async failPayment(payment: PaymentWithOrder, status: PaymentStatus, reason: string, raw?: Record<string, string | null>) {
    return prismaC.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${payment.orderId} FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "payments" WHERE "id" = ${payment.id} FOR UPDATE`);
      const current = await tx.payment.findUnique({ where: { id: payment.id }, include: { order: true } });
      if (!current || !payableStatuses.includes(current.paymentStatus) || !payableStatuses.includes(current.order.paymentStatus)) return false;
      assertPaymentTransition(current.paymentStatus, status);
      await tx.payment.update({ where: { id: current.id }, data: {
        paymentStatus: status, failureReason: reason, callbackProcessedAt: new Date(),
        ...(raw ? { providerResponse: raw as Prisma.InputJsonValue, rawResponse: raw as Prisma.InputJsonValue } : {}),
      } });
      await tx.paymentAttempt.updateMany({ where: { paymentRecordId: current.id, status: { in: payableStatuses } }, data: {
        status, failureReason: reason, verifiedAt: new Date(),
        ...(raw ? { gatewayMetadata: raw as Prisma.InputJsonValue } : {}),
      } });
      const released = await releaseGiftCardReservation(tx, current.orderId, status, reason);
      if (!released) await tx.order.update({ where: { id: current.orderId }, data: { paymentStatus: status } });
      await tx.auditLog.create({ data: { action: `PAYMENT_${status}`, entityType: "Payment", entityId: current.id, metadata: { orderId: current.orderId, reason } } });
      return true;
    });
  }

  private async verifyAndProcess(payment: PaymentWithOrder) {
    if (payment.paymentProvider !== this.provider.name) throw new ApiAppError(409, "Historical payment provider is no longer supported");
    if (payment.paymentStatus === PaymentStatus.PAID) {
      await deliverGiftCardOrder(payment.orderId);
      const queue = await prismaC.$transaction(tx => assignQueueToPaidTopUpOrder(tx, payment.orderId));
      await fulfillPaidGameTopUpOrder(payment.orderId);
      return { transactionId: payment.transactionId, status: PaymentStatus.PAID, queue };
    }
    const lateTerminal = ([PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED] as PaymentStatus[]).includes(payment.paymentStatus);
    if (!payableStatuses.includes(payment.paymentStatus) && !lateTerminal) return { transactionId: payment.transactionId, status: payment.paymentStatus, queue: [] };
    let verified: ProviderQueryPaymentResponse;
    try {
      verified = await this.provider.queryPayment({ paymentId: payment.paymentId! });
    } catch (error) {
      await this.markUnknown(payment.id, payment.orderId, "Gateway verification is temporarily unavailable");
      throw error;
    }
    assertPaymentIdentity(verified, payment);
    if (verified.status === "PAID") {
      const completed = await this.completePayment(payment, verified);
      return { ...completed, status: "refundPending" in completed && completed.refundPending ? PaymentStatus.REFUND_PENDING : PaymentStatus.PAID };
    }
    if (verified.status === "FAILED" || verified.status === "CANCELLED") {
      await this.failPayment(payment, verified.status, `Verified gateway status: ${verified.status}`, verified.raw);
      // A concurrent success may have won the lock. Return the actual committed status.
      const current = await prismaC.payment.findUniqueOrThrow({ where: { id: payment.id } });
      return { transactionId: current.transactionId, status: current.paymentStatus, queue: [] };
    }
    await this.markUnknown(payment.id, payment.orderId, "Gateway still reports a non-terminal payment state", verified.raw);
    return { transactionId: null, status: PaymentStatus.UNKNOWN, queue: [] };
  }

  // Kept as a generic compatibility endpoint; it only queries the gateway, never executes a charge.
  async executePayment(paymentId: string, userId: string) {
    const payment = await prismaC.payment.findFirst({ where: { paymentId, order: { userId } }, include: { order: { select: orderSelection } } });
    if (!payment?.paymentId) throw new ApiAppError(404, "Payment not found");
    try {
      const result = await this.verifyAndProcess(payment);
      return { ...result, dailySerial: result.queue[0]?.dailySerial ?? null, queueDate: result.queue[0]?.queueDate ?? null };
    } catch (error) { this.handleProviderError(error, "Payment verification is temporarily unavailable"); }
  }

  async handleCallback(transactionId: string): Promise<{ outcome: CallbackOutcome; orderId: string | null }> {
    const payment = await prismaC.payment.findUnique({ where: { paymentId: transactionId }, include: { order: { select: orderSelection } } });
    if (!payment?.paymentId || payment.paymentProvider !== this.provider.name) return { outcome: "failed", orderId: null };
    try {
      const result = await this.verifyAndProcess(payment);
      return { outcome: result.status === PaymentStatus.PAID ? "success" : result.status === PaymentStatus.CANCELLED ? "cancelled" : (payableStatuses.includes(result.status) || result.status === PaymentStatus.REFUND_PENDING) ? "processing" : "failed", orderId: payment.orderId };
    } catch (error) {
      // A callback and even a mismatching search response must not release reserved stock.
      if (error instanceof ApiAppError || error instanceof PaymentProviderError || (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code))) {
        logger.warn({ orderId: payment.orderId, code: error instanceof ApiAppError ? error.code : undefined }, "Payment callback could not be verified");
        return { outcome: "processing", orderId: payment.orderId };
      }
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string, userId: string) {
    const payment = await prismaC.payment.findFirst({
      where: { paymentId, order: { userId } },
      select: {
        id: true,
        paymentId: true,
        transactionId: true,
        paymentMethod: true,
        paymentProvider: true,
        paymentStatus: true,
        amount: true,
        currency: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
        reconciliationReason: true,
        attempts: { select: { id: true, gateway: true, merchantTransactionId: true, gatewayTransactionId: true, status: true, initiatedAt: true, verifiedAt: true, failureReason: true }, orderBy: { createdAt: "desc" } },
        order: { select: { id: true, orderNumber: true, totalCost: true, paymentStatus: true, status: true } },
      },
    });
    if (!payment) throw new ApiAppError(404, "Payment not found");
    return payment;
  }


  async reconcileExpiredGiftCardReservations(limit = 20) {
    const expired = await prismaC.payment.findMany({
      where: {
        paymentProvider: this.provider.name,
        paymentStatus: { in: payableStatuses }, paymentId: { not: null },
        order: { items: { some: { assignedGiftCardCodes: { some: { status: "RESERVED", reservationExpiresAt: { lte: new Date() } } } } } },
      },
      take: limit, orderBy: { createdAt: "asc" }, include: { order: { select: orderSelection } },
    });
    for (const payment of expired) {
      try {
        const result = await this.verifyAndProcess(payment);
        if (payableStatuses.includes(result.status)) await this.markUnknown(payment.id, payment.orderId, "Reservation expired while gateway status remains unknown");
      }
      catch { logger.warn({ orderId: payment.orderId }, "Reservation retained pending gateway verification"); }
    }
    await retryGiftCardDeliveries(limit);
    return expired.length;
  }

  async reconcileUnknownPayments(limit = 20) {
    const payments = await prismaC.payment.findMany({
      where: {
        paymentProvider: this.provider.name,
        paymentStatus: PaymentStatus.UNKNOWN,
        paymentId: { not: null },
      },
      take: limit,
      orderBy: { updatedAt: "asc" },
      include: { order: { select: orderSelection } },
    });
    for (const payment of payments) {
      try {
        await this.verifyAndProcess(payment);
      } catch {
        logger.warn(
          { orderId: payment.orderId, paymentId: payment.paymentId },
          "Ambiguous payment remains pending reconciliation",
        );
      }
    }
    return payments.length;
  }

  private handleProviderError(error: unknown, message: string): never {
    if (error instanceof PaymentProviderError) {
      logger.error({ provider: error.provider, details: error.details }, "Payment provider error");
      throw new ApiAppError(502, message);
    }
    throw error;
  }
}
