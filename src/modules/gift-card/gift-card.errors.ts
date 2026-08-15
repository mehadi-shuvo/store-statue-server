import { ApiAppError } from "../../utils/apiAppError";

export const giftCardError = (
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) => new ApiAppError(statusCode, message, details, code);

