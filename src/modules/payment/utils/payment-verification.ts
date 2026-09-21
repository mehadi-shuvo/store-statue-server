import type { Payment } from "../../../generated/prisma/client";
import { ApiAppError } from "../../../utils/apiAppError";
import type { ProviderQueryPaymentResponse } from "../types/payment.types";
import { amountsMatch } from "./payment.utils";

export const assertPaymentIdentity = (state: ProviderQueryPaymentResponse, payment: Pick<Payment, "paymentId" | "merchantInvoiceNumber" | "amount" | "currency">) => {
  if (!payment.paymentId || state.paymentId !== payment.paymentId || state.paymentId !== payment.merchantInvoiceNumber) throw new ApiAppError(409, "Payment transaction ID mismatch", undefined, "PAYMENT_ID_MISMATCH");
  if (!amountsMatch(payment.amount, state.amount)) throw new ApiAppError(409, "Payment amount mismatch", undefined, "PAYMENT_AMOUNT_MISMATCH");
  if ([state.currency, state.merchantCurrency].some(currency => currency !== undefined && currency.toUpperCase() !== payment.currency.toUpperCase())) throw new ApiAppError(409, "Payment currency mismatch", undefined, "PAYMENT_CURRENCY_MISMATCH");
};
export const assertVerifiedPayment = (state: ProviderQueryPaymentResponse, payment: Pick<Payment, "paymentId" | "merchantInvoiceNumber" | "amount" | "currency">) => {
  assertPaymentIdentity(state, payment);
  if (state.status !== "PAID") throw new ApiAppError(409, "Payment is not completed", undefined, "PAYMENT_NOT_COMPLETED");
  const transactionId = state.transactionId?.trim();
  if (!transactionId) throw new ApiAppError(409, "Gateway transaction ID is missing", undefined, "PAYMENT_TRX_ID_MISSING");
  return transactionId;
};
