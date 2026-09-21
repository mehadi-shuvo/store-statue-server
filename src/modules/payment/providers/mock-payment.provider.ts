import { randomUUID } from "node:crypto";
import type { IPaymentProvider } from "../interfaces/payment-provider.interface";
import type { GatewayPaymentStatus, ProviderCreatePaymentInput, ProviderQueryPaymentResponse } from "../types/payment.types";
import { PaymentProviderError } from "../utils/payment-provider-error";

// Test-only simulator. A callback never changes the simulated gateway state.
export class MockPaymentProvider implements IPaymentProvider {
  readonly name = "mock" as const;
  private readonly payments = new Map<string, ProviderQueryPaymentResponse>();
  async createPayment(input: ProviderCreatePaymentInput) {
    this.payments.set(input.transactionId, { paymentId: input.transactionId, transactionId: null, status: "PENDING", amount: input.amount, currency: input.currency, raw: {} });
    return { paymentId: input.transactionId, paymentUrl: `https://sandbox.aamarpay.com/paynow.php?track=${input.transactionId}` };
  }
  settle(paymentId: string, status: GatewayPaymentStatus = "PAID") {
    const payment = this.payments.get(paymentId);
    if (!payment) throw new Error("Unknown simulated payment");
    this.payments.set(paymentId, { ...payment, status, transactionId: payment.transactionId || (status === "PAID" ? `TEST-${randomUUID()}` : null) });
  }
  async queryPayment({ paymentId }: { paymentId: string }) {
    const payment = this.payments.get(paymentId);
    if (!payment) throw new PaymentProviderError("Unknown simulated payment", this.name);
    return payment;
  }
}
export const mockPaymentProvider = new MockPaymentProvider();
