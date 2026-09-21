import { PaymentStatus } from "../../../generated/prisma/client";
import { ApiAppError } from "../../../utils/apiAppError";

const transitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: [PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.FAILED, PaymentStatus.UNKNOWN],
  PENDING: [PaymentStatus.INITIATED, PaymentStatus.PROCESSING, PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED, PaymentStatus.UNKNOWN],
  INITIATED: [PaymentStatus.PROCESSING, PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED, PaymentStatus.UNKNOWN],
  PROCESSING: [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED, PaymentStatus.UNKNOWN],
  UNKNOWN: [PaymentStatus.PROCESSING, PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED, PaymentStatus.REFUND_PENDING],
  PAID: [PaymentStatus.REFUND_PENDING, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED],
  FAILED: [PaymentStatus.REFUND_PENDING],
  CANCELLED: [PaymentStatus.REFUND_PENDING],
  EXPIRED: [PaymentStatus.REFUND_PENDING],
  REFUND_PENDING: [PaymentStatus.REFUNDED, PaymentStatus.REFUND_FAILED],
  REFUND_FAILED: [PaymentStatus.REFUND_PENDING, PaymentStatus.REFUNDED],
  REFUNDED: [],
  PARTIALLY_REFUNDED: [PaymentStatus.REFUND_PENDING, PaymentStatus.REFUNDED],
};

export const assertPaymentTransition = (
  from: PaymentStatus,
  to: PaymentStatus,
  options: { lateVerifiedRecovery?: boolean } = {},
) => {
  if (from === to) return;
  if (
    options.lateVerifiedRecovery &&
    to === PaymentStatus.PAID &&
    ([PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED] as PaymentStatus[]).includes(from)
  ) {
    return;
  }
  if (!transitions[from].includes(to)) {
    throw new ApiAppError(
      409,
      `Payment cannot transition from ${from} to ${to}`,
      undefined,
      "INVALID_PAYMENT_TRANSITION",
    );
  }
};

export const paymentNeedsReconciliation = (status: PaymentStatus) =>
  ([
    PaymentStatus.CREATED,
    PaymentStatus.PENDING,
    PaymentStatus.INITIATED,
    PaymentStatus.PROCESSING,
    PaymentStatus.UNKNOWN,
  ] as PaymentStatus[]).includes(status);
