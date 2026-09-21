import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { ENV } from "./env-config";

const connectionString = ENV.DATABASE_URL;

const globalForPrisma = globalThis as unknown as {
  prismaC?: PrismaClient;
};

const prismaC =
  globalForPrisma.prismaC ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (ENV.NODE_ENV !== "production") {
  globalForPrisma.prismaC = prismaC;
}

export { prismaC };
