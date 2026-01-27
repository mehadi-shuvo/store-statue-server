import { NextFunction, Request, RequestHandler, Response } from "express";

const catchAsync = (fun: RequestHandler) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fun(req, res, next);
    } catch (err) {
      next(err);
    }
  };
};

export default catchAsync;
