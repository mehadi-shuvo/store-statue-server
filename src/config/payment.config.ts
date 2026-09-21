import { z } from "zod";

const optionalText = z.string().trim().default("");
const schema = z.object({
  PAYMENT_PROVIDER: z.enum(["aamarpay", "mock"]).default("aamarpay"),
  AAMARPAY_MODE: z.enum(["sandbox", "production"]).default("sandbox"),
  AAMARPAY_STORE_ID: optionalText,
  AAMARPAY_SIGNATURE_KEY: optionalText,
  AAMARPAY_BASE_URL: optionalText,
  AAMARPAY_PAYMENT_URL: optionalText,
  AAMARPAY_TRANSACTION_URL: optionalText,
  AAMARPAY_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  BACKEND_PUBLIC_URL: optionalText,
  FRONTEND_URL: optionalText,
});

export const parsePaymentEnvironment = (input: NodeJS.ProcessEnv) => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid payment configuration: ${parsed.error.issues.map(issue => issue.path.join(".")).join(", ")}`);
  }
  const config = parsed.data;
  if (config.PAYMENT_PROVIDER === "mock") {
    if (input.NODE_ENV !== "test") throw new Error("Mock payments are only allowed in NODE_ENV=test");
    return config;
  }
  const origin = config.AAMARPAY_MODE === "sandbox" ? "https://sandbox.aamarpay.com" : "https://secure.aamarpay.com";
  config.AAMARPAY_BASE_URL ||= origin;
  config.AAMARPAY_PAYMENT_URL ||= `${origin}/jsonpost.php`;
  config.AAMARPAY_TRANSACTION_URL ||= `${origin}/api/v1/trxcheck/request.php`;
  for (const key of ["AAMARPAY_STORE_ID", "AAMARPAY_SIGNATURE_KEY", "BACKEND_PUBLIC_URL", "FRONTEND_URL"] as const) {
    if (!config[key]) throw new Error(`${key} is required for aamarPay`);
  }
  for (const key of ["AAMARPAY_BASE_URL", "AAMARPAY_PAYMENT_URL", "AAMARPAY_TRANSACTION_URL", "BACKEND_PUBLIC_URL", "FRONTEND_URL"] as const) {
    let url: URL;
    try { url = new URL(config[key]); } catch { throw new Error(`${key} must be an absolute URL`); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error(`${key} must be an HTTP(S) URL without credentials, query, or fragment`);
    }
    if (key.startsWith("AAMARPAY_") && url.origin !== origin) {
      throw new Error(`${key} must use the official ${config.AAMARPAY_MODE} aamarPay host`);
    }
    if (config.AAMARPAY_MODE === "production" && url.protocol !== "https:") throw new Error(`${key} must use HTTPS in production`);
    config[key] = config[key].replace(/\/+$/, "");
  }
  if (config.AAMARPAY_MODE === "production" && config.AAMARPAY_STORE_ID === "aamarpaytest") throw new Error("Production requires a production aamarPay store");
  return config;
};
