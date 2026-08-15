import type { DigitalDeliveryPayload, DigitalDeliveryProvider } from "./digital-delivery.provider";

export class ConsoleDigitalDeliveryProvider implements DigitalDeliveryProvider {
  async deliver(payload: DigitalDeliveryPayload) {
    const cards = payload.cards.map((card) => [
      `Gift Card: ${card.giftCard}`,
      `Brand: ${card.brand}`,
      `Value: ${card.faceValue} ${card.currency}`,
      `Code: ${card.code}`,
      `PIN: ${card.pin ?? "N/A"}`,
      `Expiry: ${card.expiryDate ? card.expiryDate.toISOString().slice(0, 10) : "N/A"}`,
    ].join("\n")).join("\n\n");

    // Deliberately isolated development provider. Do not use application request logs for codes.
    console.log(`\nGIFT CARD DELIVERY\n\nTo: ${payload.to}\nOrder: ${payload.orderNumber}\n\n${cards}\n\nThank you for your purchase.\n`);
  }
}

export const digitalDeliveryProvider: DigitalDeliveryProvider = new ConsoleDigitalDeliveryProvider();
