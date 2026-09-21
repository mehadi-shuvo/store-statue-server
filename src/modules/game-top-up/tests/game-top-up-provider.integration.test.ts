import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { type TestContext } from "node:test";
import {
  DeliveryStatus,
  GameTopUpFulfillmentType,
  OrderStatus,
  PaymentStatus,
  ProductInputType,
  UserRole,
} from "../../../generated/prisma/client";
import { prismaC } from "../../../utils/prisma-client";
import { mockPaymentProvider } from "../../payment/providers/mock-payment.provider";
import { PaymentService } from "../../payment/services/payment.service";
import { gameTopUpOrderService } from "../game-top-up-order.service";
import { topUpEmailProvider } from "../providers/email-provider.factory";
import type {
  GameTopUpProviderRequest,
  GameTopUpProviderResult,
  IGameTopUpProvider,
} from "../providers/game-top-up-provider.interface";
import { GameTopUpProviderError } from "../providers/game-top-up-provider.interface";
import { setGameTopUpProviderForTests } from "../providers/game-top-up-provider.factory";
import { gameTopUpServices } from "../game-top-up.service";
import { retryGameTopUpFulfillments } from "../game-top-up-fulfillment.service";
import { ENV } from "../../../utils/env-config";

const options = { skip: process.env.RUN_GAME_TOPUP_INTEGRATION_TESTS !== "true" };

class ControlledTopUpProvider implements IGameTopUpProvider {
  readonly name = "mock";
  calls: GameTopUpProviderRequest[] = [];

  constructor(private readonly result: GameTopUpProviderResult) {}

  async topUp(request: GameTopUpProviderRequest) {
    this.calls.push(request);
    await new Promise((resolve) => setTimeout(resolve, 20));
    return this.result;
  }
}

class TimeoutThenSuccessProvider implements IGameTopUpProvider {
  readonly name = "mock";
  submissions = 0;
  queries = 0;
  async topUp(): Promise<GameTopUpProviderResult> {
    this.submissions += 1;
    throw new GameTopUpProviderError("timeout", true, true);
  }
  async queryTopUp() {
    this.queries += 1;
    return { status: "SUCCESS" as const, providerOrderId: "RECOVERED-1", message: "Confirmed." };
  }
}

const fixture = async (t: TestContext) => {
  const marker = randomUUID();
  const admin = await prismaC.user.create({
    data: {
      email: `provider-admin-${marker}@example.test`,
      name: "Provider Admin",
      password: "test-only",
      role: UserRole.ADMIN,
    },
  });
  const customer = await prismaC.user.create({
    data: {
      email: `provider-customer-${marker}@example.test`,
      name: "Provider Customer",
      password: "test-only",
      isEmailVerified: true,
    },
  });
  const game = await gameTopUpServices.createGame(admin.id, {
    name: `Provider Game ${marker}`,
    slug: `provider-game-${marker}`,
    logoUrl: "/provider-test.png",
    gameCurrencyName: "Coins",
    fulfillmentType: GameTopUpFulfillmentType.PLAYER_ID_AND_SERVER,
  });
  await gameTopUpServices.createAccountField(admin.id, game.id, {
    key: "playerId",
    label: "Player ID",
    type: ProductInputType.TEXT,
  });
  await gameTopUpServices.createAccountField(admin.id, game.id, {
    key: "zoneId",
    label: "Zone ID",
    type: ProductInputType.TEXT,
  });
  const gamePackage = await gameTopUpServices.createPackage(admin.id, game.id, {
    name: "500 Coins",
    coinAmount: 500,
    priceBdt: "500.00",
  });

  t.after(async () => {
    setGameTopUpProviderForTests(undefined);
    const orders = await prismaC.order.findMany({
      where: { userId: customer.id },
      select: { id: true, payment: { select: { id: true } } },
    });
    const orderIds = orders.map((order) => order.id);
    const entityIds = [...orderIds, ...orders.flatMap((order) => order.payment ? [order.payment.id] : [])];
    await prismaC.auditLog.deleteMany({
      where: { OR: [{ actorId: { in: [admin.id, customer.id] } }, { entityId: { in: entityIds } }] },
    });
    await prismaC.gameTopUpOrderDetail.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
    await prismaC.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prismaC.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prismaC.order.deleteMany({ where: { id: { in: orderIds } } });
    await prismaC.gameTopUpInputField.deleteMany({ where: { gameTopUpProductId: game.id } });
    await prismaC.gameTopUpPackage.deleteMany({ where: { gameTopUpProductId: game.id } });
    await prismaC.gameTopUpProduct.delete({ where: { id: game.id } });
    await prismaC.auditLog.deleteMany({ where: { actorId: admin.id } });
    await prismaC.user.deleteMany({ where: { id: { in: [admin.id, customer.id] } } });
  });

  return { admin, customer, game, gamePackage };
};

test("verified payment calls the top-up provider once and duplicate callbacks stay idempotent", options, async (t) => {
  const f = await fixture(t);
  let completionEmails = 0;
  t.mock.method(topUpEmailProvider, "sendTopUpCompleted", async () => {
    completionEmails += 1;
  });
  const provider = new ControlledTopUpProvider({
    status: "SUCCESS",
    providerOrderId: "MOCK-SUCCESS-1",
    message: "Top-up completed.",
  });
  setGameTopUpProviderForTests(provider);
  const order = await gameTopUpOrderService.createOrder(f.customer.id, {
    gameId: f.game.id,
    packageId: f.gamePackage.id,
    accountDetails: { playerId: "123456789", zoneId: "1001" },
  });
  const service = new PaymentService(mockPaymentProvider);
  const payment = await service.createPayment({ orderId: order.orderId }, f.customer.id);
  mockPaymentProvider.settle(payment.transactionId, "PAID");

  const callbacks = await Promise.all([
    service.handleCallback(payment.transactionId),
    service.handleCallback(payment.transactionId),
  ]);
  assert.ok(callbacks.every((callback) => callback.outcome === "success"));
  assert.equal(provider.calls.length, 1);
  assert.equal(provider.calls[0].gameCode, f.game.slug);
  assert.equal(provider.calls[0].packageCode, f.gamePackage.id);
  assert.deepEqual(provider.calls[0].accountDetails, { playerId: "123456789", zoneId: "1001" });

  const stored = await prismaC.order.findUniqueOrThrow({
    where: { id: order.orderId },
    include: { items: { include: { gameTopUpOrderDetail: true } }, payment: true },
  });
  assert.equal(stored.paymentStatus, PaymentStatus.PAID);
  assert.equal(stored.payment?.paymentStatus, PaymentStatus.PAID);
  assert.equal(stored.items[0].deliveryStatus, DeliveryStatus.DELIVERED);
  assert.equal(stored.items[0].fulfillmentReference, "MOCK-SUCCESS-1");
  assert.ok(stored.items[0].gameTopUpOrderDetail?.completedAt);
  assert.ok(stored.items[0].gameTopUpOrderDetail?.notificationSentAt);
  assert.equal(completionEmails, 1);

  await service.handleCallback(payment.transactionId);
  assert.equal(provider.calls.length, 1);
  assert.equal(completionEmails, 1);
  const status = await gameTopUpOrderService.getForCustomer(f.customer.id, order.orderId);
  assert.equal(status.paymentStatus, "PAID");
  assert.equal(status.fulfillmentStatus, "SUCCESS");
  assert.equal(status.providerName, "mock");
  assert.equal(status.providerOrderId, "MOCK-SUCCESS-1");
});

test("provider failure keeps payment paid and records a separate fulfillment failure", options, async (t) => {
  const f = await fixture(t);
  const provider = new ControlledTopUpProvider({
    status: "FAILED",
    providerOrderId: "MOCK-FAILED-1",
    failureCode: "ACCOUNT_NOT_FOUND",
    message: "The game account could not be found.",
  });
  setGameTopUpProviderForTests(provider);
  const order = await gameTopUpOrderService.createOrder(f.customer.id, {
    gameId: f.game.id,
    packageId: f.gamePackage.id,
    accountDetails: { playerId: "missing", zoneId: "1001" },
  });
  const service = new PaymentService(mockPaymentProvider);
  const payment = await service.createPayment({ orderId: order.orderId }, f.customer.id);
  mockPaymentProvider.settle(payment.transactionId, "PAID");
  assert.equal((await service.handleCallback(payment.transactionId)).outcome, "success");

  const stored = await prismaC.order.findUniqueOrThrow({
    where: { id: order.orderId },
    include: { items: { include: { gameTopUpOrderDetail: true } }, payment: true },
  });
  assert.equal(stored.payment?.paymentStatus, PaymentStatus.PAID);
  assert.equal(stored.items[0].deliveryStatus, DeliveryStatus.FAILED_FINAL);
  assert.equal(stored.items[0].fulfillmentReference, "MOCK-FAILED-1");
  assert.equal(stored.items[0].gameTopUpOrderDetail?.failureReason, "ACCOUNT_NOT_FOUND");
  assert.equal(provider.calls.length, 1);
});

test("failed payment never calls the top-up provider", options, async (t) => {
  const f = await fixture(t);
  const provider = new ControlledTopUpProvider({
    status: "SUCCESS",
    providerOrderId: "MUST-NOT-BE-USED",
    message: "Top-up completed.",
  });
  setGameTopUpProviderForTests(provider);
  const order = await gameTopUpOrderService.createOrder(f.customer.id, {
    packageId: f.gamePackage.id,
    accountDetails: { playerId: "123456789", zoneId: "1001" },
  });
  const service = new PaymentService(mockPaymentProvider);
  const payment = await service.createPayment({ orderId: order.orderId }, f.customer.id);
  mockPaymentProvider.settle(payment.transactionId, "FAILED");
  assert.equal((await service.handleCallback(payment.transactionId)).outcome, "failed");
  assert.equal(provider.calls.length, 0);

  const stored = await prismaC.order.findUniqueOrThrow({
    where: { id: order.orderId },
    include: { items: true },
  });
  assert.equal(stored.paymentStatus, PaymentStatus.FAILED);
  assert.equal(stored.items[0].deliveryStatus, DeliveryStatus.PENDING);
});

test("provider timeout is queried before retry and never submits a duplicate top-up", options, async (t) => {
  const f = await fixture(t);
  t.mock.method(topUpEmailProvider, "sendTopUpCompleted", async () => undefined);
  const provider = new TimeoutThenSuccessProvider();
  setGameTopUpProviderForTests(provider);
  const order = await gameTopUpOrderService.createOrder(f.customer.id, {
    packageId: f.gamePackage.id, accountDetails: { playerId: "123456789", zoneId: "1001" },
  });
  const service = new PaymentService(mockPaymentProvider);
  const payment = await service.createPayment({ orderId: order.orderId }, f.customer.id);
  mockPaymentProvider.settle(payment.transactionId, "PAID");
  await service.handleCallback(payment.transactionId);
  await service.handleCallback(payment.transactionId);
  assert.equal(provider.submissions, 1);
  assert.equal(provider.queries, 0);
  await prismaC.gameTopUpOrderDetail.updateMany({ where: { orderItem: { orderId: order.orderId } }, data: { nextRetryAt: new Date(0) } });
  await retryGameTopUpFulfillments();
  assert.equal(provider.submissions, 1);
  assert.equal(provider.queries, 1);
  const stored = await prismaC.order.findUniqueOrThrow({ where: { id: order.orderId }, include: { items: true } });
  assert.equal(stored.items[0].deliveryStatus, DeliveryStatus.DELIVERED);
});

test("bounded provider retries end in MANUAL_REVIEW while payment stays PAID", options, async (t) => {
  const f = await fixture(t);
  const originalMax = ENV.TOP_UP_MAX_PROVIDER_ATTEMPTS;
  ENV.TOP_UP_MAX_PROVIDER_ATTEMPTS = 2;
  t.after(() => { ENV.TOP_UP_MAX_PROVIDER_ATTEMPTS = originalMax; });
  const provider: IGameTopUpProvider = {
    name: "mock",
    topUp: async () => ({ status: "PENDING", providerOrderId: "PENDING-1", message: "Pending." }),
    queryTopUp: async () => ({ status: "PENDING", providerOrderId: "PENDING-1", message: "Still pending." }),
  };
  setGameTopUpProviderForTests(provider);
  const order = await gameTopUpOrderService.createOrder(f.customer.id, {
    packageId: f.gamePackage.id, accountDetails: { playerId: "123456789", zoneId: "1001" },
  });
  const service = new PaymentService(mockPaymentProvider);
  const payment = await service.createPayment({ orderId: order.orderId }, f.customer.id);
  mockPaymentProvider.settle(payment.transactionId, "PAID");
  await service.handleCallback(payment.transactionId);
  await prismaC.gameTopUpOrderDetail.updateMany({ where: { orderItem: { orderId: order.orderId } }, data: { nextRetryAt: new Date(0) } });
  await retryGameTopUpFulfillments();
  const stored = await prismaC.order.findUniqueOrThrow({ where: { id: order.orderId }, include: { items: true } });
  assert.equal(stored.paymentStatus, PaymentStatus.PAID);
  assert.equal(stored.status, OrderStatus.MANUAL_REVIEW);
  assert.equal(stored.items[0].deliveryStatus, DeliveryStatus.MANUAL_REVIEW);
});

test("order creation rejects invalid games and package/game mismatches", options, async (t) => {
  const f = await fixture(t);
  const details = { playerId: "123456789", zoneId: "1001" };
  await assert.rejects(
    () => gameTopUpOrderService.createOrder(f.customer.id, {
      gameId: randomUUID(), packageId: f.gamePackage.id, accountDetails: details,
    }),
    (error: any) => error.code === "GAME_NOT_FOUND",
  );
  const anotherGame = await gameTopUpServices.createGame(f.admin.id, {
    name: `Other ${randomUUID()}`,
    slug: `other-${randomUUID()}`,
    logoUrl: "/other.png",
    gameCurrencyName: "Credits",
    fulfillmentType: GameTopUpFulfillmentType.PLAYER_ID,
  });
  t.after(async () => {
    await prismaC.gameTopUpProduct.delete({ where: { id: anotherGame.id } });
  });
  await assert.rejects(
    () => gameTopUpOrderService.createOrder(f.customer.id, {
      gameId: anotherGame.id, packageId: f.gamePackage.id, accountDetails: details,
    }),
    (error: any) => error.code === "PACKAGE_GAME_MISMATCH",
  );
});
