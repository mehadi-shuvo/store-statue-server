import type { DigitalDeliveryPayload, DigitalDeliveryProvider } from "./digital-delivery.provider";
import { logger } from "../../../utils/logger";

export class ConsoleDigitalDeliveryProvider implements DigitalDeliveryProvider {
  async deliver(payload: DigitalDeliveryPayload) {
    // Kept only for compatibility with older callers; never print monetary secrets.
    logger.info(
      { orderNumber: payload.orderNumber, recipient: payload.to, cardCount: payload.cards.length },
      "Development gift-card delivery suppressed",
    );
  }
}

export const digitalDeliveryProvider: DigitalDeliveryProvider = new ConsoleDigitalDeliveryProvider();
