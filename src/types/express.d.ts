import type { UserRole } from "../generated/prisma/client";

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      email: string;
      role: UserRole;
    }

    interface Request {
      authUser?: AuthUser;
    }
  }
}

export {};
