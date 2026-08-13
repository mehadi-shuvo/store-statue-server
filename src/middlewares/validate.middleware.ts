import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ApiAppError } from "../utils/apiAppError";

type ValidationSchemas = {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
};

const formatIssues = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

export const validateRequest =
  ({ body, params, query }: ValidationSchemas) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }

      if (params) {
        req.params = params.parse(req.params) as Request["params"];
      }

      if (query) {
        req.query = query.parse(req.query) as Request["query"];
      }

      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new ApiAppError(400, "Invalid request", formatIssues(error)));
      }

      return next(error);
    }
  };
