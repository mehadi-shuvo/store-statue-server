import assert from "node:assert/strict";
import test from "node:test";
import { ENV } from "../../../utils/env-config";
import { MockGameTopUpProvider } from "../providers/mock-game-top-up.provider";

const request = {
  idempotencyKey: "order-item-1",
  orderId: "order-1",
  gameCode: "test-game",
  packageCode: "test-package",
  accountDetails: { playerId: "123456", zoneId: "1001" },
};

test("mock top-up provider supports configured success and failure responses", async () => {
  const originalResult = ENV.MOCK_GAME_API_RESULT;
  const originalDelay = ENV.MOCK_GAME_API_DELAY_MS;
  ENV.MOCK_GAME_API_DELAY_MS = 0;
  const provider = new MockGameTopUpProvider();
  try {
    ENV.MOCK_GAME_API_RESULT = "success";
    const success = await provider.topUp(request);
    assert.equal(success.status, "SUCCESS");

    ENV.MOCK_GAME_API_RESULT = "failed";
    const failure = await provider.topUp({ ...request, idempotencyKey: "order-item-2" });
    assert.equal(failure.status, "FAILED");
    assert.notEqual(failure.providerOrderId, success.providerOrderId);
    assert.equal(failure.failureCode, "MOCK_PROVIDER_REJECTED");
  } finally {
    ENV.MOCK_GAME_API_RESULT = originalResult;
    ENV.MOCK_GAME_API_DELAY_MS = originalDelay;
  }
});
