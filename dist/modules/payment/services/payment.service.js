"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const client_1 = require("../../../generated/prisma/client");
const apiAppError_1 = require("../../../utils/apiAppError");
const logger_1 = require("../../../utils/logger");
const prisma_client_1 = require("../../../utils/prisma-client");
const payment_provider_error_1 = require("../utils/payment-provider-error");
const payment_utils_1 = require("../utils/payment.utils");
const completedStatuses = [client_1.PaymentStatus.PAID, client_1.PaymentStatus.PROCESSING];
const terminalFailureStatuses = [
    client_1.PaymentStatus.FAILED,
    client_1.PaymentStatus.CANCELLED,
];
class PaymentService {
    constructor(provider) {
        this.provider = provider;
    }
    async createPayment(payload, userId) {
        const order = await prisma_client_1.prismaC.order.findFirst({
            where: { id: payload.orderId, userId },
            include: { payment: true },
        });
        if (!order) {
            throw new apiAppError_1.ApiAppError(404, "Order not found");
        }
        if (!(0, payment_utils_1.amountsMatch)(order.totalCost, payload.amount)) {
            throw new apiAppError_1.ApiAppError(400, "Payment amount does not match order total");
        }
        if (order.paymentStatus === client_1.PaymentStatus.PAID) {
            throw new apiAppError_1.ApiAppError(409, "Order is already paid");
        }
        if (order.payment && order.payment.paymentId && completedStatuses.includes(order.payment.paymentStatus)) {
            return {
                paymentId: order.payment.paymentId,
                paymentUrl: null,
            };
        }
        const invoiceNumber = order.orderNumber || (0, payment_utils_1.createInvoiceNumber)(order.id);
        const amount = (0, payment_utils_1.toNumberAmount)(order.totalCost);
        try {
            const providerResponse = await this.provider.createPayment({
                orderId: order.id,
                amount,
                currency: "BDT",
                invoiceNumber,
            });
            const payment = await prisma_client_1.prismaC.$transaction(async (tx) => {
                const savedPayment = await tx.payment.upsert({
                    where: { orderId: order.id },
                    create: {
                        orderId: order.id,
                        paymentMethod: client_1.PaymentMethod.BKASH,
                        paymentProvider: this.provider.name,
                        paymentStatus: client_1.PaymentStatus.PROCESSING,
                        paymentId: providerResponse.paymentID,
                        providerPaymentId: providerResponse.paymentID,
                        merchantInvoiceNumber: invoiceNumber,
                        amount: order.totalCost,
                        currency: "BDT",
                        providerResponse: providerResponse.raw,
                        rawResponse: providerResponse.raw,
                    },
                    update: {
                        paymentProvider: this.provider.name,
                        paymentStatus: client_1.PaymentStatus.PROCESSING,
                        paymentId: providerResponse.paymentID,
                        providerPaymentId: providerResponse.paymentID,
                        merchantInvoiceNumber: invoiceNumber,
                        amount: order.totalCost,
                        providerResponse: providerResponse.raw,
                        rawResponse: providerResponse.raw,
                        failureReason: null,
                    },
                });
                await tx.order.update({
                    where: { id: order.id },
                    data: { paymentStatus: client_1.PaymentStatus.PROCESSING },
                });
                return savedPayment;
            });
            return {
                paymentId: payment.paymentId,
                paymentUrl: providerResponse.bkashURL,
            };
        }
        catch (error) {
            this.handleProviderError(error, "Payment create failed");
        }
    }
    async executePayment(paymentId, userId, query = {}) {
        const payment = await prisma_client_1.prismaC.payment.findFirst({
            where: { paymentId, order: { userId } },
            include: { order: true },
        });
        if (!payment || !payment.paymentId) {
            throw new apiAppError_1.ApiAppError(404, "Payment not found");
        }
        if (payment.paymentStatus === client_1.PaymentStatus.PAID) {
            return {
                transactionId: payment.transactionId,
                status: payment.paymentStatus,
            };
        }
        if (terminalFailureStatuses.includes(payment.paymentStatus)) {
            throw new apiAppError_1.ApiAppError(409, "Payment can no longer be executed");
        }
        try {
            const execution = await this.provider.executePayment({
                paymentId,
                amount: (0, payment_utils_1.toNumberAmount)(payment.amount || payment.order.totalCost),
                scenario: query.scenario,
            });
            const verification = await this.provider.verifyPayment({
                paymentId,
                transactionId: execution.trxID,
            });
            const nextStatus = execution.transactionStatus === "Completed" &&
                verification.transactionStatus === "Completed"
                ? client_1.PaymentStatus.PAID
                : execution.transactionStatus === "Cancelled"
                    ? client_1.PaymentStatus.CANCELLED
                    : client_1.PaymentStatus.FAILED;
            const updated = await prisma_client_1.prismaC.$transaction(async (tx) => {
                const currentPayment = await tx.payment.findUnique({
                    where: { id: payment.id },
                    select: { paymentStatus: true },
                });
                if (!currentPayment || currentPayment.paymentStatus === client_1.PaymentStatus.PAID) {
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
                        providerResponse: verification.raw,
                        rawResponse: execution.raw,
                        failureReason: nextStatus === client_1.PaymentStatus.PAID ? null : execution.transactionStatus,
                        paidAt: nextStatus === client_1.PaymentStatus.PAID ? new Date() : null,
                    },
                    select: { transactionId: true, paymentStatus: true },
                });
                await tx.order.update({
                    where: { id: payment.orderId },
                    data: {
                        paymentStatus: nextStatus,
                        ...(nextStatus === client_1.PaymentStatus.PAID ? { status: client_1.OrderStatus.CONFIRMED } : {}),
                    },
                });
                return savedPayment;
            });
            return {
                transactionId: updated?.transactionId || execution.trxID,
                status: updated?.paymentStatus || nextStatus,
            };
        }
        catch (error) {
            this.handleProviderError(error, "Payment execution failed");
        }
    }
    async getPaymentStatus(paymentId, userId) {
        const payment = await prisma_client_1.prismaC.payment.findFirst({
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
            throw new apiAppError_1.ApiAppError(404, "Payment not found");
        }
        return payment;
    }
    handleProviderError(error, message) {
        if (error instanceof payment_provider_error_1.PaymentProviderError) {
            logger_1.logger.error({ provider: error.provider, details: error.details }, "Payment provider error");
            throw new apiAppError_1.ApiAppError(502, message);
        }
        throw error;
    }
}
exports.PaymentService = PaymentService;
