import { PaymentStatus } from "../../../generated/prisma/client";

export type PaymentProviderName = "mock" | "bkash";
export type MockPaymentScenario = "success" | "failure" | "cancel";

export type CreatePaymentInput = {
  orderId: string;
  amount: number;
  currency: string;
  userId: string;
};

export type ProviderCreatePaymentInput = {
  orderId: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
};

export type ProviderExecutePaymentInput = {
  paymentId: string;
  amount: number;
  scenario?: MockPaymentScenario;
};

export type ProviderQueryPaymentInput = {
  paymentId: string;
};

export type ProviderVerifyPaymentInput = {
  paymentId: string;
  transactionId?: string | null;
};

export type ProviderCreatePaymentResponse = {
  paymentID: string;
  bkashURL: string;
  statusCode: string;
  statusMessage: string;
  raw: Record<string, unknown>;
};

export type ProviderExecutePaymentResponse = {
  trxID: string | null;
  paymentID: string;
  amount: number;
  transactionStatus: "Completed" | "Failed" | "Cancelled";
  raw: Record<string, unknown>;
};

export type ProviderQueryPaymentResponse = {
  paymentID: string;
  transactionStatus: "Completed" | "Failed" | "Cancelled" | "Initiated" | "Pending";
  trxID?: string | null;
  amount?: number;
  raw: Record<string, unknown>;
};

export type PaymentExecutionResult = {
  transactionId: string | null;
  status: PaymentStatus;
};
