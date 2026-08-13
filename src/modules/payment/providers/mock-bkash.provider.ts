import { IPaymentProvider } from "../interfaces/payment-provider.interface";
import {
  ProviderCreatePaymentInput,
  ProviderCreatePaymentResponse,
  ProviderExecutePaymentInput,
  ProviderExecutePaymentResponse,
  ProviderQueryPaymentInput,
  ProviderQueryPaymentResponse,
  ProviderVerifyPaymentInput,
} from "../types/payment.types";

export class MockBkashProvider implements IPaymentProvider {
  readonly name = "mock" as const;

  async createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResponse> {
    const paymentID = `MOCK-BKASH-${input.invoiceNumber}`;
    const response = {
      paymentID,
      bkashURL: `http://localhost:5000/mock/bkash/pay/${paymentID}`,
      statusCode: "0000",
      statusMessage: "Successful",
    };

    return { ...response, raw: response };
  }

  async executePayment(input: ProviderExecutePaymentInput): Promise<ProviderExecutePaymentResponse> {
    const scenario = input.scenario || "success";
    const transactionStatus: ProviderExecutePaymentResponse["transactionStatus"] =
      scenario === "failure" ? "Failed" : scenario === "cancel" ? "Cancelled" : "Completed";
    const response = {
      trxID: transactionStatus === "Completed" ? `MOCK-TRX-${Date.now()}` : null,
      paymentID: input.paymentId,
      amount: input.amount,
      transactionStatus,
    };

    return { ...response, raw: response };
  }

  async queryPayment(input: ProviderQueryPaymentInput): Promise<ProviderQueryPaymentResponse> {
    const response = {
      paymentID: input.paymentId,
      transactionStatus: "Pending" as const,
      trxID: null,
    };

    return { ...response, raw: response };
  }

  async verifyPayment(input: ProviderVerifyPaymentInput): Promise<ProviderQueryPaymentResponse> {
    const response = {
      paymentID: input.paymentId,
      transactionStatus: input.transactionId ? ("Completed" as const) : ("Failed" as const),
      trxID: input.transactionId || null,
    };

    return { ...response, raw: response };
  }
}
