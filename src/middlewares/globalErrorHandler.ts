// app/middlewares/globalErrorHandler.ts
import { Request, Response, NextFunction } from "express";
import { ApiAppError } from "../utils/apiAppError";

export const globalErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof ApiAppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      details: error.details,
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
