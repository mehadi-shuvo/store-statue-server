import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { DeliveryStatus, GameTopUpFulfillmentType, PaymentStatus, ProductInputType, UserRole } from "../../../generated/prisma/client";
import { prismaC } from "../../../utils/prisma-client";
import { gameTopUpNotificationService } from "../game-top-up-notification.service";
import { gameTopUpOrderService } from "../game-top-up-order.service";
import { assignQueueToPaidTopUpOrder } from "../game-top-up-queue.service";
import { gameTopUpServices } from "../game-top-up.service";
import { topUpEmailProvider } from "../providers/email-provider.factory";

const run = process.env.RUN_GAME_TOPUP_INTEGRATION_TESTS === "true";

test("manual top-up workflow preserves price, serial, ownership, races, and completion", { skip: !run }, async () => {
  const marker = randomUUID();
  const admin = await prismaC.user.create({ data: { email: `topup-admin-${marker}@example.test`, name: "Top-up Admin", password: "test-only", role: UserRole.ADMIN } });
  const customer = await prismaC.user.create({ data: { email: `topup-customer-${marker}@example.test`, name: "Top-up Customer", password: "test-only" } });
  const other = await prismaC.user.create({ data: { email: `topup-other-${marker}@example.test`, name: "Other Customer", password: "test-only" } });
  let gameId: string | undefined;
  const originalSend = topUpEmailProvider.sendTopUpCompleted;

  try {
    await prismaC.dailyGameTopUpSequence.deleteMany({
      where: { queueDate: { in: [new Date("2098-03-01T00:00:00.000Z"), new Date("2098-03-02T00:00:00.000Z"), new Date("2098-03-03T00:00:00.000Z")] } },
    });
    const game = await gameTopUpServices.createGame(admin.id, {
      name: `Test Game ${marker}`, slug: `test-game-${marker}`, logoUrl: "/test.png",
      gameCurrencyName: "Gems", fulfillmentType: GameTopUpFulfillmentType.PLAYER_ID,
    });
    gameId = game.id;
    await gameTopUpServices.createAccountField(admin.id, game.id, {
      key: "playerId", label: "Player ID", type: ProductInputType.NUMBER,
      validationRules: { minLength: 6 },
    });
    const gamePackage = await gameTopUpServices.createPackage(admin.id, game.id, {
      name: "100 Gems", coinAmount: 100, priceBdt: "90.00",
    });

    await assert.rejects(() => gameTopUpOrderService.createOrder(customer.id, { packageId: randomUUID(), accountDetails: { playerId: "123456" } }), (error: any) => error.code === "PACKAGE_NOT_FOUND");
    await assert.rejects(() => gameTopUpOrderService.createOrder(customer.id, { packageId: gamePackage.id, accountDetails: {} }), (error: any) => error.code === "INVALID_ACCOUNT_DETAILS");
    await gameTopUpServices.updatePackage(admin.id, gamePackage.id, { isActive: false });
    await assert.rejects(() => gameTopUpOrderService.createOrder(customer.id, { packageId: gamePackage.id, accountDetails: { playerId: "123456" } }), (error: any) => error.code === "PACKAGE_INACTIVE");
    await gameTopUpServices.updatePackage(admin.id, gamePackage.id, { isActive: true });
    await gameTopUpServices.updateGame(admin.id, game.id, { isActive: false });
    await assert.rejects(() => gameTopUpOrderService.createOrder(customer.id, { packageId: gamePackage.id, accountDetails: { playerId: "123456" } }), (error: any) => error.code === "GAME_INACTIVE");
    await gameTopUpServices.updateGame(admin.id, game.id, { isActive: true });

    const first = await gameTopUpOrderService.createOrder(customer.id, { packageId: gamePackage.id, accountDetails: { playerId: "123456" } });
    await gameTopUpServices.updatePackage(admin.id, gamePackage.id, { priceBdt: "999.00" });
    const firstStored = await prismaC.order.findUniqueOrThrow({ where: { id: first.orderId }, include: { items: true } });
    assert.equal(firstStored.totalCost.toString(), "90");
    assert.equal(first.dailySerial, null);
    await assert.rejects(() => gameTopUpOrderService.getForCustomer(other.id, first.orderId), (error: any) => error.code === "ORDER_NOT_FOUND");

    const second = await gameTopUpOrderService.createOrder(customer.id, { packageId: gamePackage.id, accountDetails: { playerId: "654321" } });
    await prismaC.order.updateMany({ where: { id: { in: [first.orderId, second.orderId] } }, data: { paymentStatus: PaymentStatus.PAID } });
    const queueNow = new Date("2098-03-01T12:00:00.000Z");
    const assigned = await Promise.all([
      prismaC.$transaction((tx) => assignQueueToPaidTopUpOrder(tx, first.orderId, queueNow)),
      prismaC.$transaction((tx) => assignQueueToPaidTopUpOrder(tx, second.orderId, queueNow)),
    ]);
    assert.deepEqual(assigned.flat().map((value) => value.dailySerial).sort(), [1, 2]);

    const nextDay = await gameTopUpOrderService.createOrder(customer.id, { packageId: gamePackage.id, accountDetails: { playerId: "777777" } });
    await prismaC.order.update({ where: { id: nextDay.orderId }, data: { paymentStatus: PaymentStatus.PAID } });
    const nextDayQueue = await prismaC.$transaction((tx) => assignQueueToPaidTopUpOrder(tx, nextDay.orderId, new Date("2098-03-02T12:00:00.000Z")));
    assert.equal(nextDayQueue[0].dailySerial, 1);
    assert.equal((await gameTopUpOrderService.cancel(customer.id, nextDay.orderId, new Date("2098-03-02T12:00:30.000Z"))).status, "CANCELLED");
    await assert.rejects(() => gameTopUpOrderService.startProcessing(admin.id, nextDay.orderId), (error: any) => error.code === "ORDER_CLAIM_CONFLICT");

    const race = await Promise.allSettled([
      gameTopUpOrderService.startProcessing(admin.id, first.orderId, queueNow),
      gameTopUpOrderService.cancel(customer.id, first.orderId, queueNow),
    ]);
    assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(race.filter((result) => result.status === "rejected").length, 1);

    const secondStarted = await gameTopUpOrderService.startProcessing(admin.id, second.orderId, queueNow);
    assert.equal(secondStarted.items[0].deliveryStatus, DeliveryStatus.PROCESSING);
    await assert.rejects(() => gameTopUpOrderService.startProcessing(admin.id, second.orderId, queueNow), (error: any) => error.code === "ORDER_CLAIM_CONFLICT");
    await assert.rejects(() => gameTopUpOrderService.cancel(customer.id, second.orderId, queueNow), (error: any) => error.code === "ORDER_NOT_CANCELLABLE");

    topUpEmailProvider.sendTopUpCompleted = async () => { throw new Error("test provider failure"); };
    const completed = await gameTopUpOrderService.complete(admin.id, second.orderId, { previousBalance: "500", currentBalance: "600" }, queueNow);
    await gameTopUpNotificationService.notifyCompletion(completed);
    const completedItem = await prismaC.orderItem.findFirstOrThrow({ where: { orderId: second.orderId }, include: { gameTopUpOrderDetail: true } });
    assert.equal(completedItem.deliveryStatus, DeliveryStatus.DELIVERED);
    assert.equal(completedItem.gameTopUpOrderDetail?.notificationFailure, "Email provider failed");
    await assert.rejects(() => gameTopUpOrderService.complete(admin.id, second.orderId, { previousBalance: "500", currentBalance: "600" }), (error: any) => error.code === "INVALID_STATUS_TRANSITION");

    const failedOrder = await gameTopUpOrderService.createOrder(customer.id, { packageId: gamePackage.id, accountDetails: { playerId: "888888" } });
    await prismaC.order.update({ where: { id: failedOrder.orderId }, data: { paymentStatus: PaymentStatus.PAID } });
    await prismaC.$transaction((tx) => assignQueueToPaidTopUpOrder(tx, failedOrder.orderId, new Date("2098-03-03T12:00:00.000Z")));
    await assert.rejects(() => gameTopUpOrderService.complete(admin.id, failedOrder.orderId, { previousBalance: "1", currentBalance: "2" }), (error: any) => error.code === "INVALID_STATUS_TRANSITION");
    await gameTopUpOrderService.startProcessing(admin.id, failedOrder.orderId);
    const failed = await gameTopUpOrderService.fail(admin.id, failedOrder.orderId, { reason: "ACCOUNT_NOT_FOUND", customerMessage: "The game account could not be found." });
    assert.equal(failed.status, "FAILED");
  } finally {
    topUpEmailProvider.sendTopUpCompleted = originalSend;
    const orders = await prismaC.order.findMany({ where: { userId: customer.id }, select: { id: true } });
    const orderIds = orders.map((order) => order.id);
    await prismaC.auditLog.deleteMany({ where: { OR: [{ actorId: { in: [admin.id, customer.id] } }, { entityId: { in: orderIds } }] } });
    await prismaC.gameTopUpOrderDetail.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
    await prismaC.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prismaC.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prismaC.order.deleteMany({ where: { id: { in: orderIds } } });
    await prismaC.dailyGameTopUpSequence.deleteMany({
      where: { queueDate: { in: [new Date("2098-03-01T00:00:00.000Z"), new Date("2098-03-02T00:00:00.000Z"), new Date("2098-03-03T00:00:00.000Z")] } },
    });
    if (gameId) {
      await prismaC.gameTopUpInputField.deleteMany({ where: { gameTopUpProductId: gameId } });
      await prismaC.gameTopUpPackage.deleteMany({ where: { gameTopUpProductId: gameId } });
      await prismaC.gameTopUpProduct.deleteMany({ where: { id: gameId } });
    }
    await prismaC.auditLog.deleteMany({ where: { actorId: admin.id } });
    await prismaC.user.deleteMany({ where: { id: { in: [admin.id, customer.id, other.id] } } });
  }
});
