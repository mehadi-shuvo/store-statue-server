import {
  DeliveryStatus,
  DigitalProductType,
  GiftCardCodeStatus,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  Prisma,
} from "../../generated/prisma/client";
import { ENV } from "../../utils/env-config";
import { logger } from "../../utils/logger";
import { prismaC } from "../../utils/prisma-client";
import { paymentService } from "../payment/services/payment-service.factory";
import { releaseGiftCardReservation } from "./gift-card-fulfillment.service";
import { giftCardError } from "./gift-card.errors";
import { createGiftCardOrderNumber, moneyString, normalizeDeliveryEmail } from "./gift-card.utils";

type PurchaseLine = { denominationId: string; quantity: number };
type DeliveryChoice = { deliveryEmail?: string; useAccountEmail: boolean };
type LockedCode = { id: string };
type CheckoutResult = {
  orderId: string;
  paymentId: string;
  transactionId: string;
  paymentUrl: string;
  paymentExpiresAt: Date;
  id: string;
  deliveryEmail: string;
  totalBdt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
};

const resolveDeliveryEmail = async (userId: string, _choice: DeliveryChoice) => {
  const user = await prismaC.user.findUnique({
    where: { id: userId },
    select: { email: true, isEmailVerified: true },
  });
  if (!user?.email) throw giftCardError(400, "ACCOUNT_EMAIL_NOT_AVAILABLE", "Account email is not available");
  if (!user.isEmailVerified) {
    throw giftCardError(409, "EMAIL_NOT_VERIFIED", "Verify your account email before purchasing a gift card");
  }
  return normalizeDeliveryEmail(user.email);
};

const mergeLines = (lines: PurchaseLine[]) => {
  const merged = new Map<string, number>();
  for (const line of lines) merged.set(line.denominationId, (merged.get(line.denominationId) ?? 0) + line.quantity);
  return [...merged].map(([denominationId, quantity]) => ({ denominationId, quantity }));
};

const reserveCodes = async (
  tx: Prisma.TransactionClient,
  denominationId: string,
  orderItemId: string,
  quantity: number,
  reservedAt: Date,
) => {
  const codes = await tx.$queryRaw<LockedCode[]>(Prisma.sql`
    SELECT "id"
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
  const reservationExpiresAt = new Date(reservedAt.getTime() + ENV.GIFT_CARD_RESERVATION_MINUTES * 60_000);
  const updated = await tx.giftCardCode.updateMany({
    where: { id: { in: codes.map((code) => code.id) }, status: GiftCardCodeStatus.AVAILABLE },
    data: { status: GiftCardCodeStatus.RESERVED, reservedAt, reservationExpiresAt, soldAt: null, orderItemId },
  });
  if (updated.count !== quantity) {
    throw giftCardError(409, "GIFT_CARD_OUT_OF_STOCK", "Gift card stock changed during checkout");
  }
};

const existingCheckout = async (userId: string, checkoutKey?: string): Promise<CheckoutResult | null> => {
  if (!checkoutKey) return null;
  const order = await prismaC.order.findUnique({
    where: { userId_checkoutKey: { userId, checkoutKey } },
    include: {
      payment: true,
      items: {
        select: {
          assignedGiftCardCodes: {
            where: { status: GiftCardCodeStatus.RESERVED },
            select: { reservationExpiresAt: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!order) return null;
  if (order.status !== OrderStatus.PENDING || order.paymentStatus !== PaymentStatus.PROCESSING || order.payment?.paymentProvider !== ENV.PAYMENT_PROVIDER) {
    throw giftCardError(409, "DUPLICATE_CHECKOUT", "This checkout request was already processed");
  }
  const response = order.payment?.providerResponse;
  const paymentUrl = response && typeof response === "object" && !Array.isArray(response)
    && typeof (response as Record<string, unknown>).paymentUrl === "string"
    ? String((response as Record<string, unknown>).paymentUrl)
    : null;
  if (!order.payment?.paymentId || !paymentUrl) {
    throw giftCardError(409, "DUPLICATE_CHECKOUT", "This checkout request was already processed");
  }
  const paymentExpiresAt = order.items
    .flatMap((item) => item.assignedGiftCardCodes)
    .find((code) => code.reservationExpiresAt)?.reservationExpiresAt;
  if (!paymentExpiresAt) {
    throw giftCardError(409, "DUPLICATE_CHECKOUT", "This checkout request was already processed");
  }
  return {
    orderId: order.id, paymentId: order.payment.paymentId, transactionId: order.payment.paymentId, paymentUrl,
    paymentExpiresAt,
    id: order.id, deliveryEmail: order.deliveryEmail || "", totalBdt: moneyString(order.totalCost),
    status: order.status, paymentStatus: order.paymentStatus,
  };
};

const createPurchase = async (
  userId: string,
  rawLines: PurchaseLine[],
  choice: DeliveryChoice,
  cartItemIds: string[] = [],
  checkoutKey?: string,
): Promise<CheckoutResult> => {
  const duplicate = await existingCheckout(userId, checkoutKey);
  if (duplicate) return duplicate;
  const lines = mergeLines(rawLines);
  if (!lines.length || lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20)) {
    throw giftCardError(400, "INVALID_CART", "Purchase quantities must be between 1 and 20");
  }
  const deliveryEmail = await resolveDeliveryEmail(userId, choice);
  const reservedAt = new Date();
  const paymentExpiresAt = new Date(
    reservedAt.getTime() + ENV.GIFT_CARD_RESERVATION_MINUTES * 60_000,
  );

  const pending = await prismaC.$transaction(async (tx) => {
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
        orderNumber: createGiftCardOrderNumber(), userId, deliveryEmail, checkoutKey,
        subtotal, discountTotal: new Prisma.Decimal(0), totalCost: subtotal, currency: "BDT",
        status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING,
      },
    });
    for (const { line, denomination, product } of selections) {
      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id, productType: DigitalProductType.GIFT_CARD, quantity: line.quantity,
          unitPrice: denomination.sellingPriceBDT, totalPrice: denomination.sellingPriceBDT.mul(line.quantity),
          productTitle: product.title,
          optionTitle: `${moneyString(denomination.cardValue)} ${denomination.cardCurrency}`,
          productImage: product.image, deliveryStatus: DeliveryStatus.PENDING,
          giftCardProductId: product.id, giftCardDenominationId: denomination.id,
          brandSnapshot: product.brand, faceValueSnapshot: denomination.cardValue,
          faceCurrencySnapshot: denomination.cardCurrency,
        },
      });
      await reserveCodes(tx, denomination.id, orderItem.id, line.quantity, reservedAt);
    }
    if (cartItemIds.length) {
      await tx.cartItem.deleteMany({ where: { id: { in: cartItemIds }, cart: { userId } } });
    }
    await tx.auditLog.create({
      data: {
        actorId: userId, action: "GIFT_CARD_INVENTORY_RESERVED", entityType: "Order", entityId: order.id,
        metadata: { itemCount: lines.reduce((sum, line) => sum + line.quantity, 0) },
      },
    });
    return order;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });

  logger.info({ orderId: pending.id, userId }, "Gift-card order created and inventory reserved");
  try {
    const payment = await paymentService.createPayment({ orderId: pending.id }, userId);
    return {
      orderId: pending.id, paymentId: payment.paymentId, transactionId: payment.transactionId, paymentUrl: payment.paymentUrl,
      paymentExpiresAt,
      id: pending.id, deliveryEmail, totalBdt: moneyString(pending.totalCost),
      status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PROCESSING,
    };
  } catch (error) {
    const initiated = await prismaC.payment.findUnique({ where: { orderId: pending.id }, select: { id: true } });
    // If a request reached the gateway, its outcome may be ambiguous. The payment
    // service releases only definite rejection; callbacks/reconciliation resolve the rest.
    if (!initiated) await prismaC.$transaction(async (tx) => {
      await releaseGiftCardReservation(tx, pending.id, PaymentStatus.FAILED, "Payment creation failed");
    });
    logger.warn({ orderId: pending.id }, "Gift-card payment initialization did not finish");
    throw error;
  }
};

const resolveBuyNowDenomination = async (productId: string) => {
  const denomination = await prismaC.giftCardDenomination.findUnique({ where: { id: productId }, select: { id: true } });
  if (denomination) return denomination.id;
  const product = await prismaC.giftCardProduct.findFirst({
    where: { id: productId, deletedAt: null },
    select: { denominations: { where: { isActive: true }, select: { id: true }, take: 2 } },
  });
  if (!product) throw giftCardError(404, "GIFT_CARD_NOT_FOUND", "Gift card product not found");
  if (product.denominations.length !== 1) {
    throw giftCardError(400, "DENOMINATION_REQUIRED", "Select a specific gift-card denomination");
  }
  return product.denominations[0].id;
};

const buyNow = async (userId: string, input: { productId: string; quantity: number }, checkoutKey?: string) =>
  createPurchase(
    userId,
    [{ denominationId: await resolveBuyNowDenomination(input.productId), quantity: input.quantity }],
    { useAccountEmail: true }, [], checkoutKey,
  );

const instantBuy = (userId: string, input: PurchaseLine & DeliveryChoice, checkoutKey?: string) =>
  createPurchase(userId, [{ denominationId: input.denominationId, quantity: input.quantity }], input, [], checkoutKey);

const checkoutCart = async (userId: string, choice: DeliveryChoice, checkoutKey?: string) => {
  const cart = await prismaC.cart.findUnique({ where: { userId }, include: { items: true } });
  if (!cart?.items.length) throw giftCardError(400, "EMPTY_CART", "Cart is empty");
  if (cart.items.some((item) => item.productType !== DigitalProductType.GIFT_CARD || !item.giftCardDenominationId)) {
    throw giftCardError(400, "INVALID_CART", "Gift card checkout cannot contain other product types");
  }
  return createPurchase(
    userId,
    cart.items.map((item) => ({ denominationId: item.giftCardDenominationId!, quantity: item.quantity })),
    choice, cart.items.map((item) => item.id), checkoutKey,
  );
};

export const giftCardPurchaseService = { buyNow, instantBuy, checkoutCart, createPurchase };
