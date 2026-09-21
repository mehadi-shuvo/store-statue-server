import type { PaymentProviderName, ProviderCreatePaymentInput, ProviderCreatePaymentResponse, ProviderQueryPaymentResponse } from "../types/payment.types";
export interface IPaymentProvider {
  readonly name: PaymentProviderName;
  createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResponse>;
  queryPayment(input: { paymentId: string }): Promise<ProviderQueryPaymentResponse>;
}
