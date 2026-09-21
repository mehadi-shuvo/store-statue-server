import { z } from "zod";

const schema = z.object({
  GAME_TOPUP_PROVIDER: z.enum(["mock"]).default("mock"),
  MOCK_GAME_API_RESULT: z.enum([
    "success",
    "pending",
    "failed",
    "timeout",
    "delayed_success",
    "provider_down",
    "insufficient_balance",
  ]).default("success"),
  MOCK_GAME_API_DELAY_MS: z.coerce.number().int().min(0).max(120_000).default(3_000),
  MOCK_GAME_PROVIDER_BALANCE: z.coerce.number().min(0).default(1_000_000),
  TOP_UP_RETRY_BACKOFF_SECONDS: z.string().trim().default("30,120,600,1800"),
  TOP_UP_PROCESSING_STALE_SECONDS: z.coerce.number().int().min(30).max(86_400).default(300),
  TOP_UP_WORKER_INTERVAL_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(30_000),
  TOP_UP_MAX_PROVIDER_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  TOP_UP_EMAIL_RETRY_MINUTES: z.coerce.number().int().min(1).max(1_440).default(5),
  TOP_UP_EMAIL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
});

export const parseGameTopUpProviderEnvironment = (input: NodeJS.ProcessEnv) => {
  if (input.NODE_ENV === "production" && !input.GAME_TOPUP_PROVIDER) {
    throw new Error(
      "Invalid game top-up provider configuration: GAME_TOPUP_PROVIDER must be explicitly set in production",
    );
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Invalid game top-up provider configuration: ${parsed.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ")}`,
    );
  }
  const backoff = parsed.data.TOP_UP_RETRY_BACKOFF_SECONDS
    .split(",")
    .map((value) => Number(value.trim()));
  if (!backoff.length || backoff.some((value) => !Number.isInteger(value) || value < 1 || value > 86_400)) {
    throw new Error("Invalid game top-up provider configuration: TOP_UP_RETRY_BACKOFF_SECONDS");
  }
  return { ...parsed.data, TOP_UP_RETRY_BACKOFF_SECONDS: backoff };
};
