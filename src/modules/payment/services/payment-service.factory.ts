import { getPaymentProvider } from "../providers/payment-provider.factory";
import { PaymentService } from "./payment.service";

export const paymentService = new PaymentService(getPaymentProvider());
