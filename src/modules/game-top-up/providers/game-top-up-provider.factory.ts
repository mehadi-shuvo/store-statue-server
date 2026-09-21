import { ENV } from "../../../utils/env-config";
import type { IGameTopUpProvider } from "./game-top-up-provider.interface";
import { MockGameTopUpProvider } from "./mock-game-top-up.provider";

let provider: IGameTopUpProvider | undefined;

export const getGameTopUpProvider = (): IGameTopUpProvider => {
  if (provider) return provider;
  if (ENV.GAME_TOPUP_PROVIDER === "mock") provider = new MockGameTopUpProvider();
  if (!provider) throw new Error(`Unsupported game top-up provider: ${ENV.GAME_TOPUP_PROVIDER}`);
  return provider;
};

export const setGameTopUpProviderForTests = (value?: IGameTopUpProvider) => {
  if (ENV.NODE_ENV !== "test") throw new Error("Top-up provider overrides are only allowed in tests");
  provider = value;
};
