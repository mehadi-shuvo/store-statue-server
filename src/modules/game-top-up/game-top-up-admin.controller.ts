import catchAsync from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/api-response";
import { gameTopUpNotificationService } from "./game-top-up-notification.service";
import { gameTopUpOrderService } from "./game-top-up-order.service";
import { gameTopUpServices } from "./game-top-up.service";

const response = (res: Parameters<typeof sendSuccess>[0], statusCode: number, message: string, data: unknown) =>
  sendSuccess(res, { statusCode, message, data });

const listGames = catchAsync(async (req, res) => response(res, 200, "Games fetched successfully", await gameTopUpServices.listAdminGames(req.query as never)));
const getGame = catchAsync(async (req, res) => response(res, 200, "Game fetched successfully", await gameTopUpServices.getAdminGame(req.params.gameId)));
const createGame = catchAsync(async (req, res) => response(res, 201, "Game created successfully", await gameTopUpServices.createGame(req.authUser!.id, req.body)));
const updateGame = catchAsync(async (req, res) => response(res, 200, "Game updated successfully", await gameTopUpServices.updateGame(req.authUser!.id, req.params.gameId, req.body)));
const archiveGame = catchAsync(async (req, res) => response(res, 200, "Game archived successfully", await gameTopUpServices.archiveGame(req.authUser!.id, req.params.gameId)));

const createPackage = catchAsync(async (req, res) => response(res, 201, "Package created successfully", await gameTopUpServices.createPackage(req.authUser!.id, req.params.gameId, req.body)));
const listPackages = catchAsync(async (req, res) => response(res, 200, "Packages fetched successfully", await gameTopUpServices.listPackages(req.params.gameId)));
const getPackage = catchAsync(async (req, res) => response(res, 200, "Package fetched successfully", await gameTopUpServices.getPackage(req.params.packageId)));
const updatePackage = catchAsync(async (req, res) => response(res, 200, "Package updated successfully", await gameTopUpServices.updatePackage(req.authUser!.id, req.params.packageId, req.body)));
const deactivatePackage = catchAsync(async (req, res) => response(res, 200, "Package deactivated successfully", await gameTopUpServices.deactivatePackage(req.authUser!.id, req.params.packageId)));

const createAccountField = catchAsync(async (req, res) => response(res, 201, "Account field created successfully", await gameTopUpServices.createAccountField(req.authUser!.id, req.params.gameId, req.body)));
const listAccountFields = catchAsync(async (req, res) => response(res, 200, "Account fields fetched successfully", await gameTopUpServices.listAccountFields(req.params.gameId)));
const updateAccountField = catchAsync(async (req, res) => response(res, 200, "Account field updated successfully", await gameTopUpServices.updateAccountField(req.authUser!.id, req.params.fieldId, req.body)));
const deactivateAccountField = catchAsync(async (req, res) => response(res, 200, "Account field deactivated successfully", await gameTopUpServices.deactivateAccountField(req.authUser!.id, req.params.fieldId)));

const listOrders = catchAsync(async (req, res) => response(res, 200, "Top-up queue fetched successfully", await gameTopUpOrderService.listForAdmin(req.query as never)));
const getOrder = catchAsync(async (req, res) => response(res, 200, "Top-up order fetched successfully", await gameTopUpOrderService.getForAdmin(req.authUser!.id, req.params.orderId)));
const startOrder = catchAsync(async (req, res) => response(res, 200, "Top-up processing started", await gameTopUpOrderService.startProcessing(req.authUser!.id, req.params.orderId)));
const completeOrder = catchAsync(async (req, res) => {
  const data = await gameTopUpOrderService.complete(req.authUser!.id, req.params.orderId, req.body);
  await gameTopUpNotificationService.notifyCompletion(data);
  response(res, 200, "Top-up completed successfully", await gameTopUpOrderService.getForAdmin(req.authUser!.id, req.params.orderId));
});
const failOrder = catchAsync(async (req, res) => response(res, 200, "Top-up marked as failed", await gameTopUpOrderService.fail(req.authUser!.id, req.params.orderId, req.body)));

export const gameTopUpAdminController = {
  listGames, getGame, createGame, updateGame, archiveGame,
  createPackage, listPackages, getPackage, updatePackage, deactivatePackage,
  createAccountField, listAccountFields, updateAccountField, deactivateAccountField,
  listOrders, getOrder, startOrder, completeOrder, failOrder,
};
