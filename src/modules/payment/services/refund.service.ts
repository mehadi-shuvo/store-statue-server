import {
  OrderStatus,
  PaymentStatus,
  type Prisma,
} from "../../../generated/prisma/client";

export const markRefundPending = async (
  tx: Prisma.TransactionClient,
  input: {
    paymentId: string;
    orderId: string;
    gatewayTransactionId: string;
    reason: string;
    metadata?: Prisma.InputJsonValue;
  },
) => {
  await tx.payment.update({
    where: { id: input.paymentId },
    data: {
      paymentStatus: PaymentStatus.REFUND_PENDING,
      transactionId: input.gatewayTransactionId,
      providerPaymentId: input.gatewayTransactionId,
      paidAt: new Date(),
      callbackProcessedAt: new Date(),
      failureReason: input.reason,
      reconciliationReason: input.reason,
    },
  });
  await tx.order.update({
    where: { id: input.orderId },
    data: {
      paymentStatus: PaymentStatus.REFUND_PENDING,
      status: OrderStatus.REFUND_PENDING,
    },
  });
  await tx.auditLog.create({
    data: {
      action: "REFUND_REQUESTED",
      entityType: "Payment",
      entityId: input.paymentId,
      metadata: input.metadata ?? { orderId: input.orderId, reason: input.reason },
    },
  });
};

export const refundService = { markRefundPending };
