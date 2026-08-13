import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../generated/prisma/client";
import { ApiAppError } from "../utils/apiAppError";
import { ENV } from "../utils/env-config";
import { prismaC } from "../utils/prisma-client";

type JwtPayload = {
  userId?: string;
  email?: string;
  role?: UserRole;
};

const getTokenFromRequest = (req: Request) => {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }

  return req.cookies?.accessToken;
};

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      throw new ApiAppError(401, "Authentication token is required");
    }

    if (!ENV.JWT_SECRET) {
      throw new ApiAppError(500, "JWT secret is not configured");
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;

    if (!decoded.userId) {
      throw new ApiAppError(401, "Invalid authentication token");
    }

    const user = await prismaC.user.findFirst({
      where: {
        id: decoded.userId,
        isActive: true,
        isDeleted: false,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new ApiAppError(401, "User not found or inactive");
    }

    req.authUser = user;
    next();
  } catch (error) {
    if (error instanceof ApiAppError) {
      return next(error);
    }

    return next(new ApiAppError(401, "Invalid or expired authentication token"));
  }
};

export const optionalAuthenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next();
  }

  return authenticateUser(req, res, next);
};

export const authorizeRoles =
  (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return next(new ApiAppError(401, "Authentication token is required"));
    }

    if (!roles.includes(req.authUser.role)) {
      return next(new ApiAppError(403, "You are not allowed to perform this action"));
    }

    return next();
  };

export const requireAdmin = authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN);
