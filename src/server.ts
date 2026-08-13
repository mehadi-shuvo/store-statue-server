import app from "./app";
import { ENV } from "./utils/env-config";
import { logger } from "./utils/logger";
import { prismaC } from "./utils/prisma-client";

const port = Number(ENV.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server is running");
});

server.on("error", (error) => {
  logger.fatal({ error }, "Server failed to start");
  void prismaC.$disconnect().finally(() => process.exit(1));
});

let shuttingDown = false;
const shutdown = (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down server");

  server.close(async (error) => {
    try {
      await prismaC.$disconnect();
    } finally {
      if (error) logger.error({ error }, "Server shutdown failed");
      process.exit(error ? 1 : 0);
    }
  });

  const forceExitTimer = setTimeout(() => process.exit(1), 10_000);
  forceExitTimer.unref();
};

for (const signal of ["SIGINT", "SIGTERM"] as NodeJS.Signals[]) {
  process.once(signal, () => shutdown(signal));
}

process.on("unhandledRejection", (error) => {
  logger.fatal({ error }, "Unhandled promise rejection");
  if (!shuttingDown) {
    shutdown("SIGTERM");
  }
});
