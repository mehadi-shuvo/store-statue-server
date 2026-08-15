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
        // Express 5 exposes req.query as a getter without a setter. Define a
        // request-local validated value so downstream handlers receive Zod's
        // coercions/defaults without attempting to assign to the prototype getter.
        Object.defineProperty(req, "query", {
          value: query.parse(req.query) as Request["query"],
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }

      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new ApiAppError(400, "Invalid request", formatIssues(error)));
      }

      return next(error);
    }
  };
