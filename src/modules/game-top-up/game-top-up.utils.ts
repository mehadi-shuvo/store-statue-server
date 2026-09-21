import { randomUUID } from "node:crypto";
import { ProductInputType, type GameTopUpInputField, type Prisma } from "../../generated/prisma/client";
import { gameTopUpError } from "./game-top-up.errors";

type AccountField = Pick<GameTopUpInputField, "name" | "label" | "type" | "isRequired" | "options" | "validationRules">;
type ValidationRules = { minLength?: number; maxLength?: number; pattern?: string; patternMessage?: string };
type SelectOption = { label: string; value: string };

export const createTopUpOrderNumber = (now = new Date()) =>
  `GT-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

export const moneyString = (value: { toFixed: (digits: number) => string } | string | number) =>
  typeof value === "object" ? value.toFixed(2) : Number(value).toFixed(2);

export const maskIdentifier = (value: string) => {
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
  }
  if (value.length <= 4) return "*".repeat(value.length);
  return `${"*".repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;
};

export const maskAccountDetails = (details: Prisma.JsonValue | null) => {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [key, typeof value === "string" ? maskIdentifier(value) : "****"]),
  );
};

const asRules = (value: Prisma.JsonValue | null): ValidationRules =>
  value && typeof value === "object" && !Array.isArray(value) ? value as ValidationRules : {};

const asOptions = (value: Prisma.JsonValue | null): SelectOption[] =>
  Array.isArray(value) ? value.filter((item): item is SelectOption => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return typeof item.value === "string" && typeof item.label === "string";
  }) : [];

const validateValue = (field: AccountField, value: unknown) => {
  if (typeof value !== "string") {
    throw gameTopUpError(422, "INVALID_ACCOUNT_DETAILS", `${field.label} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized && field.isRequired) {
    throw gameTopUpError(422, "INVALID_ACCOUNT_DETAILS", `${field.label} is required`);
  }
  const rules = asRules(field.validationRules);
  if (rules.minLength && normalized.length < rules.minLength) {
    throw gameTopUpError(422, "INVALID_ACCOUNT_DETAILS", `${field.label} is too short`);
  }
  if (rules.maxLength && normalized.length > rules.maxLength) {
    throw gameTopUpError(422, "INVALID_ACCOUNT_DETAILS", `${field.label} is too long`);
  }
  if (rules.pattern) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(rules.pattern);
    } catch {
      throw gameTopUpError(500, "INVALID_ACCOUNT_FIELD_CONFIGURATION", `${field.label} has an invalid validation pattern`);
    }
    if (!pattern.test(normalized)) {
      throw gameTopUpError(422, "INVALID_ACCOUNT_DETAILS", rules.patternMessage || `${field.label} has an invalid format`);
    }
  }
  if (field.type === ProductInputType.EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw gameTopUpError(422, "INVALID_ACCOUNT_DETAILS", `${field.label} must be a valid email`);
  }
  if (field.type === ProductInputType.NUMBER && !/^\d+$/.test(normalized)) {
    throw gameTopUpError(422, "INVALID_ACCOUNT_DETAILS", `${field.label} must contain digits only`);
  }
  if (field.type === ProductInputType.PHONE && !/^\+?[0-9][0-9 -]{5,19}$/.test(normalized)) {
    throw gameTopUpError(422, "INVALID_ACCOUNT_DETAILS", `${field.label} must be a valid phone number`);
  }
  if ((field.type === ProductInputType.SELECT || field.type === ProductInputType.RADIO) && !asOptions(field.options).some((option) => option.value === normalized)) {
    throw gameTopUpError(422, "INVALID_ACCOUNT_DETAILS", `${field.label} must use a configured option`);
  }
  return normalized;
};

export const validateAccountDetails = (
  fields: AccountField[],
  submitted: Record<string, unknown>,
): Prisma.InputJsonObject => {
  const allowed = new Set(fields.map((field) => field.name));
  const unexpected = Object.keys(submitted).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw gameTopUpError(422, "INVALID_ACCOUNT_DETAILS", "Unexpected account detail fields", { fields: unexpected });
  }

  const credentialKeys = Object.keys(submitted).filter((key) => /(password|passcode|secret|otp|token)/i.test(key));
  if (credentialKeys.length) {
    throw gameTopUpError(422, "CREDENTIAL_FIELDS_FORBIDDEN", "Passwords and authentication secrets are never accepted");
  }

  const result: Record<string, string> = {};
  for (const field of fields) {
    const value = submitted[field.name];
    if (value === undefined || value === null || value === "") {
      if (field.isRequired) {
        throw gameTopUpError(422, "INVALID_ACCOUNT_DETAILS", `${field.label} is required`);
      }
      continue;
    }
    result[field.name] = validateValue(field, value);
  }
  return result as Prisma.InputJsonObject;
};
