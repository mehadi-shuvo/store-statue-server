import { ENV } from "../../../utils/env-config";
import { IPaymentProvider } from "../interfaces/payment-provider.interface";
import { BkashProvider } from "./bkash.provider";
import { MockBkashProvider } from "./mock-bkash.provider";

export const getPaymentProvider = (): IPaymentProvider => {
  if (ENV.PAYMENT_PROVIDER === "bkash") {
    return new BkashProvider();
  }

  return new MockBkashProvider();
};
