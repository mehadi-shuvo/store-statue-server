import { DeliveryStatus, DigitalProductType, GiftCardCodeStatus, OrderStatus, PaymentStatus, type Prisma } from "../../generated/prisma/client";
import { prismaC } from "../../utils/prisma-client";
import { giftCardError } from "./gift-card.errors";
import { moneyString } from "./gift-card.utils";
import { decryptGiftCardSecret } from "./gift-card-crypto";

type PageQuery = { page: number; limit: number };
type AdminQuery = PageQuery & {
  status?: Prisma.EnumOrderStatusFilter | string;
  paymentStatus?: Prisma.EnumPaymentStatusFilter | string;
  email?: string;
  orderNumber?: string;
  from?: string;
  to?: string;
};

const listForCustomer = async (userId: string, query: PageQuery) => {
  const where: Prisma.OrderWhereInput = { userId, items: { some: { productType: DigitalProductType.GIFT_CARD } } };
  const [orders, total] = await prismaC.$transaction([
    prismaC.order.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, orderNumber: true, totalCost: true, status: true, paymentStatus: true, createdAt: true,
        items: {
          where: { productType: DigitalProductType.GIFT_CARD },
          select: { id: true, productTitle: true, productImage: true, brandSnapshot: true, faceValueSnapshot: true, faceCurrencySnapshot: true, unitPrice: true, quantity: true, deliveryStatus: true },
        },
      },
    }),
    prismaC.order.count({ where }),
  ]);
  return {
    data: orders.map((order) => ({
      ...order,
      totalBdt: moneyString(order.totalCost),
      items: order.items.map((item) => ({
        ...item,
        giftCardName: item.productTitle,
        brand: item.brandSnapshot,
        faceValue: item.faceValueSnapshot ? moneyString(item.faceValueSnapshot) : null,
        currency: item.faceCurrencySnapshot,
        priceBdt: moneyString(item.unitPrice),
      })),
    })),
    meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
  };
};

const getForCustomer = async (userId: string, orderId: string) => {
  const order = await prismaC.order.findFirst({
    where: { id: orderId, userId, items: { some: { productType: DigitalProductType.GIFT_CARD } } },
    include: {
      payment: { select: { paymentStatus: true } },
      items: {
        where: { productType: DigitalProductType.GIFT_CARD },
        include: {
          giftCardDeliveries: {
            include: { inventoryCode: { select: { code: true, pin: true, expiryDate: true, status: true } } },
          },
        },
      },
    },
  });
  if (!order) throw giftCardError(404, "ORDER_NOT_FOUND", "Gift card order not found");
  const canReveal = order.status === OrderStatus.COMPLETED
    && order.paymentStatus === PaymentStatus.PAID
    && order.payment?.paymentStatus === PaymentStatus.PAID;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    deliveryEmail: order.deliveryEmail,
    totalBdt: moneyString(order.totalCost),
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      giftCardName: item.productTitle,
      brand: item.brandSnapshot,
      imageUrl: item.productImage,
      faceValue: item.faceValueSnapshot ? moneyString(item.faceValueSnapshot) : null,
      currency: item.faceCurrencySnapshot,
      priceBdt: moneyString(item.unitPrice),
      quantity: item.quantity,
      deliveryStatus: item.deliveryStatus,
      deliveries: canReveal ? item.giftCardDeliveries.filter((delivery) => delivery.inventoryCode.status === GiftCardCodeStatus.SOLD).map((delivery) => ({
        code: decryptGiftCardSecret(delivery.inventoryCode.code)!,
        pin: decryptGiftCardSecret(delivery.inventoryCode.pin),
        expiryDate: delivery.expiryDateSnapshot,
      })) : [],
    })),
  };
};

const getDeliveryForCustomer = async (userId: string, orderId: string) => {
  const order = await prismaC.order.findFirst({
    where: {
      id: orderId,
      userId,
      status: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      payment: { is: { paymentStatus: PaymentStatus.PAID } },
      items: { some: { productType: DigitalProductType.GIFT_CARD } },
    },
    select: {
      id: true,
      orderNumber: true,
      payment: { select: { paymentMethod: true, transactionId: true } },
      items: {
        where: { productType: DigitalProductType.GIFT_CARD },
        select: {
          productTitle: true,
          brandSnapshot: true,
          faceValueSnapshot: true,
          faceCurrencySnapshot: true,
          giftCardDeliveries: {
            where: { inventoryCode: { status: GiftCardCodeStatus.SOLD } },
            select: {
              expiryDateSnapshot: true,
              deliveryStatus: true,
              inventoryCode: { select: { code: true, pin: true } },
            },
          },
        },
      },
    },
  });
  if (!order) throw giftCardError(404, "DELIVERY_NOT_FOUND", "Paid gift-card delivery not found");
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    products: order.items.map((item) => ({
      name: item.productTitle,
      brand: item.brandSnapshot,
      value: item.faceValueSnapshot ? moneyString(item.faceValueSnapshot) : null,
      currency: item.faceCurrencySnapshot,
      delivery: item.giftCardDeliveries.map((delivery) => ({
        code: decryptGiftCardSecret(delivery.inventoryCode.code)!,
        pin: decryptGiftCardSecret(delivery.inventoryCode.pin),
        expiryDate: delivery.expiryDateSnapshot,
        emailStatus: delivery.deliveryStatus,
      })),
    })),
    payment: { provider: order.payment?.paymentMethod, trxId: order.payment?.transactionId },
  };
};

const listForAdmin = async (query: AdminQuery) => {
  const where: Prisma.OrderWhereInput = {
    items: { some: { productType: DigitalProductType.GIFT_CARD } },
    ...(query.status && { status: query.status as never }),
    ...(query.paymentStatus && { paymentStatus: query.paymentStatus as never }),
    ...(query.email && { deliveryEmail: { contains: query.email, mode: "insensitive" } }),
    ...(query.orderNumber && { orderNumber: { contains: query.orderNumber, mode: "insensitive" } }),
    ...((query.from || query.to) && { createdAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } }),
  };
  const [data, total] = await prismaC.$transaction([
    prismaC.order.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: "desc" },
      select: {
        id: true, orderNumber: true, deliveryEmail: true, totalCost: true, status: true, paymentStatus: true, createdAt: true,
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prismaC.order.count({ where }),
  ]);
  return { data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
};

const getForAdmin = async (orderId: string) => {
  const order = await prismaC.order.findFirst({
    where: { id: orderId, items: { some: { productType: DigitalProductType.GIFT_CARD } } },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: {
        where: { productType: DigitalProductType.GIFT_CARD },
        include: { giftCardDeliveries: { include: { inventoryCode: true } } },
      },
    },
  });
  if (!order) throw giftCardError(404, "ORDER_NOT_FOUND", "Gift card order not found");
  return order;
};

export const giftCardOrderService = { listForCustomer, getForCustomer, getDeliveryForCustomer, listForAdmin, getForAdmin };
