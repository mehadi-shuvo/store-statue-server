import { z } from "zod";

export const createPaymentSchema = z.object({
  orderId: z.string().uuid("Invalid order id"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
}).strict();

export const executePaymentSchema = z.object({
  paymentId: z.string().min(1, "Payment id is required"),
}).strict();

export const paymentParamsSchema = z.object({
  paymentId: z.string().min(1, "Payment id is required"),
}).strict();

export const paymentScenarioQuerySchema = z.object({
  scenario: z.enum(["success", "failure", "cancel"]).optional(),
}).strict();

export type CreatePaymentPayload = z.infer<typeof createPaymentSchema>;
export type ExecutePaymentPayload = z.infer<typeof executePaymentSchema>;
export type PaymentScenarioQuery = z.infer<typeof paymentScenarioQuerySchema>;
