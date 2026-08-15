import {
  DeliveryStatus,
  DigitalProductType,
  GiftCardCodeStatus,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  Prisma,
  type GiftCardDenomination,
  type GiftCardProduct,
} from "../../generated/prisma/client";
import { prismaC } from "../../utils/prisma-client";
import { digitalDeliveryProvider } from "./providers/console-digital-delivery.provider";
import { giftCardError } from "./gift-card.errors";
import { createGiftCardOrderNumber, moneyString, normalizeDeliveryEmail } from "./gift-card.utils";

type PurchaseLine = { denominationId: string; quantity: number };
type DeliveryChoice = { deliveryEmail?: string; useAccountEmail: boolean };

type LockedCode = {
  id: string;
  code: string;
  pin: string | null;
  expiryDate: Date | null;
};

const resolveDeliveryEmail = async (userId: string, choice: DeliveryChoice) => {
  if (choice.useAccountEmail) {
    const user = await prismaC.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) throw giftCardError(400, "ACCOUNT_EMAIL_NOT_AVAILABLE", "Account email is not available");
    return normalizeDeliveryEmail(user.email);
  }
  if (!choice.deliveryEmail) throw giftCardError(400, "DELIVERY_EMAIL_REQUIRED", "Delivery email is required");
  return normalizeDeliveryEmail(choice.deliveryEmail);
};

const mergeLines = (lines: PurchaseLine[]) => {
  const merged = new Map<string, number>();
  for (const line of lines) merged.set(line.denominationId, (merged.get(line.denominationId) ?? 0) + line.quantity);
  return [...merged].map(([denominationId, quantity]) => ({ denominationId, quantity }));
};

const allocateCodes = async (
  tx: Prisma.TransactionClient,
  denominationId: string,
  orderItemId: string,
  quantity: number,
  soldAt: Date,
) => {
  const codes = await tx.$queryRaw<LockedCode[]>(Prisma.sql`
    SELECT "id", "code", "pin", "expiryDate"
    FROM "gift_card_codes"
    WHERE "denominationId" = ${denominationId}
      AND "status" = 'AVAILABLE'::"GiftCardCodeStatus"
      AND ("expiryDate" IS NULL OR "expiryDate" > NOW())
    ORDER BY "createdAt" ASC
    FOR UPDATE SKIP LOCKED
    LIMIT ${quantity}
  `);

  if (codes.length !== quantity) {
    throw giftCardError(409, "INSUFFICIENT_GIFT_CARD_STOCK", "Not enough gift card codes are available", {
      denominationId,
      requested: quantity,
      available: codes.length,
    });
  }

  const updated = await tx.giftCardCode.updateMany({
    where: { id: { in: codes.map((code) => code.id) }, status: GiftCardCodeStatus.AVAILABLE },
    data: { status: GiftCardCodeStatus.SOLD, soldAt, reservedAt: null, orderItemId },
  });
  if (updated.count !== quantity) {
    throw giftCardError(409, "GIFT_CARD_OUT_OF_STOCK", "Gift card stock changed during checkout");
  }
  return codes;
};

const createPurchase = async (
  userId: string,
  rawLines: PurchaseLine[],
  choice: DeliveryChoice,
  cartItemIds: string[] = [],
) => {
  const lines = mergeLines(rawLines);
  if (!lines.length || lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20)) {
    throw giftCardError(400, "INVALID_CART", "Purchase quantities must be between 1 and 20");
  }
  const deliveryEmail = await resolveDeliveryEmail(userId, choice);
  const fulfilledAt = new Date();

  const completed = await prismaC.$transaction(async (tx) => {
    const denominations = await tx.giftCardDenomination.findMany({
      where: { id: { in: lines.map((line) => line.denominationId) } },
      include: { giftCardProduct: true },
    });
    if (denominations.length !== lines.length) {
      throw giftCardError(404, "GIFT_CARD_DENOMINATION_NOT_FOUND", "A gift card denomination was not found");
    }

    const selections = lines.map((line) => {
      const denomination = denominations.find((item) => item.id === line.denominationId)!;
      if (denomination.giftCardProduct.deletedAt || denomination.giftCardProduct.status !== ProductStatus.ACTIVE) {
        throw giftCardError(409, "GIFT_CARD_INACTIVE", "Gift card is not active");
      }
      if (!denomination.isActive) {
        throw giftCardError(409, "GIFT_CARD_DENOMINATION_INACTIVE", "Gift card denomination is not active");
      }
      return { line, denomination, product: denomination.giftCardProduct };
    });

    const subtotal = selections.reduce(
      (sum, selection) => sum.add(selection.denomination.sellingPriceBDT.mul(selection.line.quantity)),
      new Prisma.Decimal(0),
    );
    const order = await tx.order.create({
      data: {
        orderNumber: createGiftCardOrderNumber(),
        userId,
        deliveryEmail,
        subtotal,
        discountTotal: new Prisma.Decimal(0),
        totalCost: subtotal,
        status: OrderStatus.PROCESSING,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    const deliveryPayload: Array<{
      giftCard: string;
      brand: string;
      faceValue: string;
      currency: string;
      code: string;
      pin: string | null;
      expiryDate: Date | null;
    }> = [];

    for (const { line, denomination, product } of selections) {
      const lineTotal = denomination.sellingPriceBDT.mul(line.quantity);
      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productType: DigitalProductType.GIFT_CARD,
          quantity: line.quantity,
          unitPrice: denomination.sellingPriceBDT,
          totalPrice: lineTotal,
          productTitle: product.title,
          optionTitle: `${moneyString(denomination.cardValue)} ${denomination.cardCurrency}`,
          productImage: product.image,
          deliveryStatus: DeliveryStatus.PROCESSING,
          giftCardProductId: product.id,
          giftCardDenominationId: denomination.id,
          brandSnapshot: product.brand,
          faceValueSnapshot: denomination.cardValue,
          faceCurrencySnapshot: denomination.cardCurrency,
        },
      });
      const codes = await allocateCodes(tx, denomination.id, orderItem.id, line.quantity, fulfilledAt);
      for (const code of codes) {
        await tx.giftCardDelivery.create({
          data: {
            orderItemId: orderItem.id,
            inventoryCodeId: code.id,
            cardNameSnapshot: product.title,
            brandSnapshot: product.brand,
            faceValueSnapshot: denomination.cardValue,
            currencySnapshot: denomination.cardCurrency,
            expiryDateSnapshot: code.expiryDate,
            deliveryEmail,
            deliveryStatus: DeliveryStatus.DELIVERED,
            deliveredAt: fulfilledAt,
          },
        });
        deliveryPayload.push({
          giftCard: product.title,
          brand: product.brand,
          faceValue: moneyString(denomination.cardValue),
          currency: denomination.cardCurrency,
          code: code.code,
          pin: code.pin,
          expiryDate: code.expiryDate,
        });
      }
      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: { deliveryStatus: DeliveryStatus.DELIVERED, fulfilledAt },
      });
    }

    if (cartItemIds.length) {
      await tx.cartItem.deleteMany({ where: { id: { in: cartItemIds }, cart: { userId } } });
    }
    await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.COMPLETED } });
    return { orderId: order.id, orderNumber: order.orderNumber, deliveryPayload, subtotal };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });

  try {
    await digitalDeliveryProvider.deliver({
      to: deliveryEmail,
      orderNumber: completed.orderNumber,
      cards: completed.deliveryPayload,
    });
  } catch (error) {
    await prismaC.$transaction([
      prismaC.giftCardDelivery.updateMany({
        where: { orderItem: { orderId: completed.orderId } },
        data: { deliveryStatus: DeliveryStatus.FAILED, failureReason: "Digital delivery provider failed" },
      }),
      prismaC.orderItem.updateMany({
        where: { orderId: completed.orderId, productType: DigitalProductType.GIFT_CARD },
        data: { deliveryStatus: DeliveryStatus.FAILED, failureReason: "Digital delivery provider failed" },
      }),
      prismaC.order.update({ where: { id: completed.orderId }, data: { status: OrderStatus.PROCESSING } }),
    ]);
    throw giftCardError(502, "GIFT_CARD_DELIVERY_FAILED", "The order was created, but digital delivery failed");
  }

  return {
    id: completed.orderId,
    orderNumber: completed.orderNumber,
    deliveryEmail,
    totalBdt: moneyString(completed.subtotal),
    status: OrderStatus.COMPLETED,
    paymentStatus: PaymentStatus.PENDING,
  };
};

const instantBuy = (userId: string, input: PurchaseLine & DeliveryChoice) =>
  createPurchase(userId, [{ denominationId: input.denominationId, quantity: input.quantity }], input);

const checkoutCart = async (userId: string, choice: DeliveryChoice) => {
  const cart = await prismaC.cart.findUnique({ where: { userId }, include: { items: true } });
  if (!cart?.items.length) throw giftCardError(400, "EMPTY_CART", "Cart is empty");
  if (cart.items.some((item) => item.productType !== DigitalProductType.GIFT_CARD || !item.giftCardDenominationId)) {
    throw giftCardError(400, "INVALID_CART", "Gift card checkout cannot contain other product types");
  }
  return createPurchase(
    userId,
    cart.items.map((item) => ({ denominationId: item.giftCardDenominationId!, quantity: item.quantity })),
    choice,
    cart.items.map((item) => item.id),
  );
};

export const giftCardPurchaseService = { instantBuy, checkoutCart, createPurchase };
