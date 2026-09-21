import { z } from "zod";
export const createPaymentSchema = z.object({ orderId: z.string().uuid("Invalid order id") }).strict();
export const executePaymentSchema = z.object({ paymentId: z.string().trim().min(1).max(255) }).strict();
export const paymentParamsSchema = executePaymentSchema;
const transactionId = z.string().trim().regex(/^[A-Za-z0-9_-]{1,32}$/, "Invalid transaction identifier");
// Unknown gateway fields (including credentials) are discarded, never forwarded or persisted.
export const aamarpayCallbackSchema = z.object({ mer_txnid: transactionId.optional() });
export const aamarpayCallbackQuerySchema = z.object({ transactionId: transactionId.optional() });
export type CreatePaymentPayload = z.infer<typeof createPaymentSchema>;
