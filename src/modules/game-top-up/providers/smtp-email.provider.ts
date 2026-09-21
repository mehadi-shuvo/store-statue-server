import { gameTopUpCompletedTemplate } from "../../../utils/email-templates";
import { sendEmail } from "../../../utils/sendEmail";
import type { EmailProvider } from "./email.provider";

export const smtpTopUpEmailProvider: EmailProvider = {
  async sendTopUpCompleted(payload) {
    const template = gameTopUpCompletedTemplate({
      customerName: payload.customerName,
      orderNumber: payload.orderNumber,
      game: payload.game,
      packageName: payload.packageName,
      completedAt: payload.completedAt,
    });
    await sendEmail({ to: payload.to, ...template });
  },
};
