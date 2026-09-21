import { randomBytes } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client";
type AmountValue = { toString(): string } | number | string;
export const amountsMatch = (left: AmountValue, right: AmountValue) => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(right.toString())) return false;
  return new Prisma.Decimal(left.toString()).equals(right.toString());
};
export const createTransactionId = () => `GX_${randomBytes(14).toString("hex")}`;
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
