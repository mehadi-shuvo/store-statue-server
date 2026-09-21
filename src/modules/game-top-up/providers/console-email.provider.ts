import { logger } from "../../../utils/logger";
import type { EmailProvider } from "./email.provider";

export const consoleTopUpEmailProvider: EmailProvider = {
  async sendTopUpCompleted(payload) {
    logger.info({
      notification: "EMAIL_MOCK",
      to: payload.to,
      subject: `Your ${payload.game} Top-Up Is Complete`,
      orderNumber: payload.orderNumber,
      order: payload.dailySerial ? `#${payload.dailySerial}` : "completed",
      package: payload.packageName,
    }, "Top-up completion email mock");
  },
};
