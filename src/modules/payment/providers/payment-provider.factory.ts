import { ENV } from "../../../utils/env-config";
import type { IPaymentProvider } from "../interfaces/payment-provider.interface";
import { AamarpayProvider } from "./aamarpay.provider";
import { mockPaymentProvider } from "./mock-payment.provider";
export const getPaymentProvider = (): IPaymentProvider =>
  ENV.PAYMENT_PROVIDER === "aamarpay" ? new AamarpayProvider() : mockPaymentProvider;
