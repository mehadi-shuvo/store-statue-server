export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}
