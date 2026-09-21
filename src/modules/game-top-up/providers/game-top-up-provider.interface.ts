export type GameTopUpProviderRequest = {
  idempotencyKey: string;
  orderId: string;
  gameCode: string;
  packageCode: string;
  accountDetails: Record<string, string>;
};

export type GameTopUpProviderResult =
  | {
      status: "SUCCESS";
      providerOrderId: string;
      message: string;
    }
  | {
      status: "PENDING";
      providerOrderId: string;
      message: string;
    }
  | {
      status: "FAILED";
      providerOrderId: string;
      message: string;
      failureCode: string;
      retryable?: boolean;
    };

export type GameTopUpProviderHealth = {
  available: boolean;
  balance?: number;
  reason?: "PROVIDER_DOWN" | "INSUFFICIENT_PROVIDER_BALANCE";
};

export class GameTopUpProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly statusUnknown: boolean,
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

export interface IGameTopUpProvider {
  readonly name: string;
  topUp(request: GameTopUpProviderRequest): Promise<GameTopUpProviderResult>;
  queryTopUp?(request: Pick<GameTopUpProviderRequest, "idempotencyKey" | "orderId"> & {
    providerOrderId?: string | null;
  }): Promise<GameTopUpProviderResult>;
  getHealth?(): Promise<GameTopUpProviderHealth>;
}
