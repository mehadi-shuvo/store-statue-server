import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { ApiAppError } from "../../utils/apiAppError";
import { ENV } from "../../utils/env-config";

const PREFIX = "enc:v1";

const encryptionKey = () => {
  const key = Buffer.from(ENV.GIFT_CARD_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new ApiAppError(500, "Gift-card encryption is not configured");
  }
  return key;
};

export const assertGiftCardEncryptionConfigured = () => { encryptionKey(); };

export const giftCardSecretHash = (value: string) =>
  createHmac("sha256", encryptionKey()).update(value.trim(), "utf8").digest("hex");

export const encryptGiftCardSecret = (value: string | null | undefined) => {
  if (value == null) return null;
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
};

export const decryptGiftCardSecret = (value: string | null | undefined) => {
  if (value == null) return null;
  if (!value.startsWith(`${PREFIX}:`)) return value; // Backward-compatible legacy plaintext.
  const [, , ivValue, tagValue, ciphertextValue] = value.split(":");
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new ApiAppError(500, "Stored gift-card secret is invalid");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ApiAppError(500, "Stored gift-card secret could not be decrypted");
  }
};
