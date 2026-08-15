import { randomUUID } from "node:crypto";

export const moneyString = (value: { toFixed: (digits: number) => string } | string | number) =>
  typeof value === "object"
    ? value.toFixed(2)
    : (() => {
        const [whole, fraction = ""] = String(value).split(".");
        return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
      })();

export const maskGiftCardCode = (code: string) => {
  const parts = code.split("-");
  if (parts.length >= 3) {
    return [parts[0], ...parts.slice(1, -1).map((part) => "*".repeat(Math.max(part.length, 4))), parts[parts.length - 1]].join("-");
  }
  if (code.length <= 4) return "*".repeat(code.length);
  return `${code.slice(0, 4)}${"*".repeat(Math.max(code.length - 8, 4))}${code.slice(-4)}`;
};

export const normalizeDeliveryEmail = (email: string) => email.trim().toLowerCase();

export const createGiftCardOrderNumber = (now = new Date()) => {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `GC-${date}-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
};
