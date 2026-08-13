"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_config_1 = require("./utils/env-config");
const logger_1 = require("./utils/logger");
const prisma_client_1 = require("./utils/prisma-client");
const port = Number(env_config_1.ENV.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
}
const server = app_1.default.listen(port, () => {
    logger_1.logger.info({ port }, "Server is running");
});
server.on("error", (error) => {
    logger_1.logger.fatal({ error }, "Server failed to start");
    void prisma_client_1.prismaC.$disconnect().finally(() => process.exit(1));
});
let shuttingDown = false;
const shutdown = (signal) => {
    if (shuttingDown)
        return;
    shuttingDown = true;
    logger_1.logger.info({ signal }, "Shutting down server");
    server.close(async (error) => {
        try {
            await prisma_client_1.prismaC.$disconnect();
        }
        finally {
            if (error)
                logger_1.logger.error({ error }, "Server shutdown failed");
            process.exit(error ? 1 : 0);
        }
    });
    const forceExitTimer = setTimeout(() => process.exit(1), 10000);
    forceExitTimer.unref();
};
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => shutdown(signal));
}
process.on("unhandledRejection", (error) => {
    logger_1.logger.fatal({ error }, "Unhandled promise rejection");
    if (!shuttingDown) {
        shutdown("SIGTERM");
    }
});
