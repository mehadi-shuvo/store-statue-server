export type PaymentProviderName = "mock" | "aamarpay";
export type GatewayPaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";
export type CallbackOutcome = "success" | "failed" | "cancelled" | "processing";
export type ProviderCreatePaymentInput = {
  orderId: string;
  transactionId: string;
  amount: string;
  currency: string;
  customer: {
    name: string;
    email: string;
    phone: string | null;
    addressLine?: string;
    city?: string;
    country?: string;
    postalCode?: string | null;
  };
};
export type ProviderCreatePaymentResponse = { paymentId: string; paymentUrl: string };
export type ProviderQueryPaymentResponse = {
  paymentId: string;
  transactionId: string | null;
  status: GatewayPaymentStatus;
  amount: string;
  currency?: string;
  merchantCurrency?: string;
  // Only allowlisted, non-sensitive verification fields are persisted.
  raw: Record<string, string | null>;
};
