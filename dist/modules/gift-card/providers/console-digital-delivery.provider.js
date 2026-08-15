"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.digitalDeliveryProvider = exports.ConsoleDigitalDeliveryProvider = void 0;
class ConsoleDigitalDeliveryProvider {
    async deliver(payload) {
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
exports.ConsoleDigitalDeliveryProvider = ConsoleDigitalDeliveryProvider;
exports.digitalDeliveryProvider = new ConsoleDigitalDeliveryProvider();
