import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  type Prisma,
} from "../../../generated/prisma/client";
import { ApiAppError } from "../../../utils/apiAppError";
import { logger } from "../../../utils/logger";
import { prismaC } from "../../../utils/prisma-client";
import { IPaymentProvider } from "../interfaces/payment-provider.interface";
import { PaymentProviderError } from "../utils/payment-provider-error";
import { amountsMatch, createInvoiceNumber, toNumberAmount } from "../utils/payment.utils";
import { CreatePaymentPayload, PaymentScenarioQuery } from "../validators/payment.validation";

const completedStatuses: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.PROCESSING];
const terminalFailureStatuses: PaymentStatus[] = [
  PaymentStatus.FAILED,
  PaymentStatus.CANCELLED,
];

export class PaymentService {
  constructor(private readonly provider: IPaymentProvider) {}

  async createPayment(payload: CreatePaymentPayload, userId: string) {
    const order = await prismaC.order.findFirst({
      where: { id: payload.orderId, userId },
      include: { payment: true },
    });

    if (!order) {
      throw new ApiAppError(404, "Order not found");
    }

    if (!amountsMatch(order.totalCost, payload.amount)) {
      throw new ApiAppError(400, "Payment amount does not match order total");
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new ApiAppError(409, "Order is already paid");
    }

    if (order.payment && order.payment.paymentId && completedStatuses.includes(order.payment.paymentStatus)) {
      return {
        paymentId: order.payment.paymentId,
        paymentUrl: null,
      };
    }

    const invoiceNumber = order.orderNumber || createInvoiceNumber(order.id);
    const amount = toNumberAmount(order.totalCost);

    try {
      const providerResponse = await this.provider.createPayment({
        orderId: order.id,
        amount,
        currency: "BDT",
        invoiceNumber,
      });

      const payment = await prismaC.$transaction(async (tx) => {
        const savedPayment = await tx.payment.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            paymentMethod: PaymentMethod.BKASH,
            paymentProvider: this.provider.name,
            paymentStatus: PaymentStatus.PROCESSING,
            paymentId: providerResponse.paymentID,
            providerPaymentId: providerResponse.paymentID,
            merchantInvoiceNumber: invoiceNumber,
            amount: order.totalCost,
            currency: "BDT",
            providerResponse: providerResponse.raw as Prisma.InputJsonValue,
            rawResponse: providerResponse.raw as Prisma.InputJsonValue,
          },
          update: {
            paymentProvider: this.provider.name,
            paymentStatus: PaymentStatus.PROCESSING,
            paymentId: providerResponse.paymentID,
            providerPaymentId: providerResponse.paymentID,
            merchantInvoiceNumber: invoiceNumber,
            amount: order.totalCost,
            providerResponse: providerResponse.raw as Prisma.InputJsonValue,
            rawResponse: providerResponse.raw as Prisma.InputJsonValue,
            failureReason: null,
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: PaymentStatus.PROCESSING },
        });

        return savedPayment;
      });

      return {
        paymentId: payment.paymentId,
        paymentUrl: providerResponse.bkashURL,
      };
    } catch (error) {
      this.handleProviderError(error, "Payment create failed");
    }
  }

  async executePayment(paymentId: string, userId: string, query: PaymentScenarioQuery = {}) {
    const payment = await prismaC.payment.findFirst({
      where: { paymentId, order: { userId } },
      include: { order: true },
    });

    if (!payment || !payment.paymentId) {
      throw new ApiAppError(404, "Payment not found");
    }

    if (payment.paymentStatus === PaymentStatus.PAID) {
      return {
        transactionId: payment.transactionId,
        status: payment.paymentStatus,
      };
    }

    if (terminalFailureStatuses.includes(payment.paymentStatus)) {
      throw new ApiAppError(409, "Payment can no longer be executed");
    }

    try {
      const execution = await this.provider.executePayment({
        paymentId,
        amount: toNumberAmount(payment.amount || payment.order.totalCost),
        scenario: query.scenario,
      });
      const verification = await this.provider.verifyPayment({
        paymentId,
        transactionId: execution.trxID,
      });
      const nextStatus =
        execution.transactionStatus === "Completed" &&
        verification.transactionStatus === "Completed"
          ? PaymentStatus.PAID
          : execution.transactionStatus === "Cancelled"
            ? PaymentStatus.CANCELLED
            : PaymentStatus.FAILED;

      const updated = await prismaC.$transaction(async (tx) => {
        const currentPayment = await tx.payment.findUnique({
          where: { id: payment.id },
          select: { paymentStatus: true },
        });

        if (!currentPayment || currentPayment.paymentStatus === PaymentStatus.PAID) {
          return tx.payment.findUnique({
            where: { id: payment.id },
            select: { transactionId: true, paymentStatus: true },
          });
        }

        const savedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            paymentStatus: nextStatus,
            transactionId: execution.trxID,
            providerResponse: verification.raw as Prisma.InputJsonValue,
            rawResponse: execution.raw as Prisma.InputJsonValue,
            failureReason: nextStatus === PaymentStatus.PAID ? null : execution.transactionStatus,
            paidAt: nextStatus === PaymentStatus.PAID ? new Date() : null,
          },
          select: { transactionId: true, paymentStatus: true },
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: nextStatus,
            ...(nextStatus === PaymentStatus.PAID ? { status: OrderStatus.CONFIRMED } : {}),
          },
        });

        return savedPayment;
      });

      return {
        transactionId: updated?.transactionId || execution.trxID,
        status: updated?.paymentStatus || nextStatus,
      };
    } catch (error) {
      this.handleProviderError(error, "Payment execution failed");
    }
  }

  async getPaymentStatus(paymentId: string, userId: string) {
    const payment = await prismaC.payment.findFirst({
      where: { paymentId, order: { userId } },
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

    if (!payment) {
      throw new ApiAppError(404, "Payment not found");
    }

    return payment;
  }

  private handleProviderError(error: unknown, message: string): never {
    if (error instanceof PaymentProviderError) {
      logger.error(
        { provider: error.provider, details: error.details },
        "Payment provider error",
      );
      throw new ApiAppError(502, message);
    }

    throw error;
  }
}
