import { createHash } from "node:crypto";
import { ENV } from "../../../utils/env-config";
import type {
  GameTopUpProviderRequest,
  GameTopUpProviderResult,
  GameTopUpProviderHealth,
  IGameTopUpProvider,
} from "./game-top-up-provider.interface";
import { GameTopUpProviderError } from "./game-top-up-provider.interface";

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class MockGameTopUpProvider implements IGameTopUpProvider {
  readonly name = "mock";
  private readonly requests = new Map<string, GameTopUpProviderResult>();

  async getHealth(): Promise<GameTopUpProviderHealth> {
    if (ENV.MOCK_GAME_API_RESULT === "provider_down") {
      return { available: false, reason: "PROVIDER_DOWN" };
    }
    if (ENV.MOCK_GAME_API_RESULT === "insufficient_balance") {
      return {
        available: false,
        balance: ENV.MOCK_GAME_PROVIDER_BALANCE,
        reason: "INSUFFICIENT_PROVIDER_BALANCE",
      };
    }
    return { available: true, balance: ENV.MOCK_GAME_PROVIDER_BALANCE };
  }

  async topUp(request: GameTopUpProviderRequest): Promise<GameTopUpProviderResult> {
    const existing = this.requests.get(request.idempotencyKey);
    if (existing) return existing;
    await delay(ENV.MOCK_GAME_API_DELAY_MS);
    const reference = createHash("sha256")
      .update(request.idempotencyKey)
      .digest("hex")
      .slice(0, 20)
      .toUpperCase();
    const providerOrderId = `MOCK-${reference}`;

    if (ENV.MOCK_GAME_API_RESULT === "provider_down") {
      throw new GameTopUpProviderError("The mock provider is unavailable.", true, false);
    }
    if (ENV.MOCK_GAME_API_RESULT === "timeout") {
      const pending: GameTopUpProviderResult = {
        status: "PENDING",
        providerOrderId,
        message: "The provider request status is unknown.",
      };
      this.requests.set(request.idempotencyKey, pending);
      throw new GameTopUpProviderError("The mock provider timed out.", true, true);
    }
    if (ENV.MOCK_GAME_API_RESULT === "failed" || ENV.MOCK_GAME_API_RESULT === "insufficient_balance") {
      const failed: GameTopUpProviderResult = {
        status: "FAILED",
        providerOrderId,
        failureCode: ENV.MOCK_GAME_API_RESULT === "insufficient_balance"
          ? "INSUFFICIENT_PROVIDER_BALANCE"
          : "MOCK_PROVIDER_REJECTED",
        message: "The top-up provider could not complete this order.",
      };
      this.requests.set(request.idempotencyKey, failed);
      return failed;
    }
    if (["pending", "delayed_success"].includes(ENV.MOCK_GAME_API_RESULT)) {
      const pending: GameTopUpProviderResult = {
        status: "PENDING",
        providerOrderId,
        message: "The game top-up is pending provider confirmation.",
      };
      this.requests.set(request.idempotencyKey, pending);
      return pending;
    }
    const successful: GameTopUpProviderResult = {
      status: "SUCCESS",
      providerOrderId,
      message: "The game top-up was completed successfully.",
    };
    this.requests.set(request.idempotencyKey, successful);
    return successful;
  }

  async queryTopUp(request: Pick<GameTopUpProviderRequest, "idempotencyKey" | "orderId"> & {
    providerOrderId?: string | null;
  }): Promise<GameTopUpProviderResult> {
    await delay(ENV.MOCK_GAME_API_DELAY_MS);
    if (ENV.MOCK_GAME_API_RESULT === "provider_down") {
      throw new GameTopUpProviderError("The mock provider is unavailable.", true, true);
    }
    const current = this.requests.get(request.idempotencyKey);
    if (!current) {
      throw new GameTopUpProviderError("The mock provider has no matching request.", false, true);
    }
    if (current.status === "PENDING" && ["success", "delayed_success"].includes(ENV.MOCK_GAME_API_RESULT)) {
      const successful: GameTopUpProviderResult = {
        status: "SUCCESS",
        providerOrderId: current.providerOrderId,
        message: "The delayed game top-up was completed successfully.",
      };
      this.requests.set(request.idempotencyKey, successful);
      return successful;
    }
    return current;
  }
}
