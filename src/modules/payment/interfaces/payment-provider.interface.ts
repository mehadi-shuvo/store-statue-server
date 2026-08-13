import {
  ProviderCreatePaymentInput,
  ProviderCreatePaymentResponse,
  ProviderExecutePaymentInput,
  ProviderExecutePaymentResponse,
  ProviderQueryPaymentInput,
  ProviderQueryPaymentResponse,
  ProviderVerifyPaymentInput,
} from "../types/payment.types";

export interface IPaymentProvider {
  readonly name: "mock" | "bkash";
  createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResponse>;
  executePayment(input: ProviderExecutePaymentInput): Promise<ProviderExecutePaymentResponse>;
  queryPayment(input: ProviderQueryPaymentInput): Promise<ProviderQueryPaymentResponse>;
  verifyPayment(input: ProviderVerifyPaymentInput): Promise<ProviderQueryPaymentResponse>;
}
