import type { Response } from "express";

type SuccessResponseOptions<T> = {
  statusCode?: number;
  message: string;
  data?: T;
  meta?: unknown;
};

/** Sends the established API success envelope without changing its wire format. */
export const sendSuccess = <T>(
  res: Response,
  { statusCode = 200, message, data, meta }: SuccessResponseOptions<T>,
) =>
  res.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
    ...(meta !== undefined ? { meta } : {}),
  });
