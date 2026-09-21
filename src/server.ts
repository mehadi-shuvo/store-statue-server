import app from "./app";
import { ENV } from "./utils/env-config";
import { logger } from "./utils/logger";
import { prismaC } from "./utils/prisma-client";
import { paymentService } from "./modules/payment/services/payment-service.factory";
import { assertGiftCardEncryptionConfigured } from "./modules/gift-card/gift-card-crypto";
import { retryGameTopUpFulfillments } from "./modules/game-top-up/game-top-up-fulfillment.service";
import { gameTopUpNotificationService } from "./modules/game-top-up/game-top-up-notification.service";

const port = ENV.PORT;
if (ENV.PAYMENT_PROVIDER === "aamarpay") assertGiftCardEncryptionConfigured();

const server = app.listen(port, () => {
  logger.info({ port }, "Server is running");
});

let paymentWorkerRunning = false;
const runPaymentWorker = async () => {
  if (paymentWorkerRunning) return;
  paymentWorkerRunning = true;
  try {
    await paymentService.reconcileExpiredGiftCardReservations();
    await paymentService.reconcileUnknownPayments();
  } catch (error) {
    logger.warn({ error }, "Payment reconciliation worker failed");
  } finally {
    paymentWorkerRunning = false;
  }
};
const reservationSweep = setInterval(
  () => void runPaymentWorker(),
  Math.max(10_000, ENV.GIFT_CARD_RESERVATION_SWEEP_MS),
);
reservationSweep.unref();

let topUpWorkerRunning = false;
const topUpWorker = setInterval(() => {
  if (topUpWorkerRunning) return;
  topUpWorkerRunning = true;
  void retryGameTopUpFulfillments()
    .then(() => gameTopUpNotificationService.retryTopUpNotifications())
    .catch((error) => logger.warn({ error }, "Game top-up worker failed"))
    .finally(() => {
      topUpWorkerRunning = false;
    });
}, ENV.TOP_UP_WORKER_INTERVAL_MS);
topUpWorker.unref();

server.on("error", (error) => {
  logger.fatal({ error }, "Server failed to start");
  void prismaC.$disconnect().finally(() => process.exit(1));
});

let shuttingDown = false;
const shutdown = (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(reservationSweep);
  clearInterval(topUpWorker);
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
