export type DigitalDeliveryCard = {
  giftCard: string;
  brand: string;
  faceValue: string;
  currency: string;
  code: string;
  pin: string | null;
  expiryDate: Date | null;
};

export type DigitalDeliveryPayload = {
  to: string;
  orderNumber: string;
  cards: DigitalDeliveryCard[];
};

export interface DigitalDeliveryProvider {
  deliver(payload: DigitalDeliveryPayload): Promise<void>;
}
