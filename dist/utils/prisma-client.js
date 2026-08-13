"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismaC = void 0;
require("dotenv/config");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("../generated/prisma/client");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma");
}
const globalForPrisma = globalThis;
const prismaC = globalForPrisma.prismaC ??
    new client_1.PrismaClient({ adapter: new adapter_pg_1.PrismaPg({ connectionString }) });
exports.prismaC = prismaC;
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaC = prismaC;
}
