type AmountValue = { toString(): string } | number | string;

export const toNumberAmount = (value: AmountValue) => Number(value.toString());

export const amountsMatch = (left: AmountValue, right: AmountValue) =>
  Math.abs(toNumberAmount(left) - toNumberAmount(right)) < 0.01;

export const createInvoiceNumber = (orderId: string) =>
  `INV-${orderId.slice(0, 8)}-${Date.now()}`;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
