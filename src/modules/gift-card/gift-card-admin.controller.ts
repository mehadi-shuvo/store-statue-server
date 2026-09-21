import catchAsync from "../../utils/catchAsync";
import { sendSuccess } from "../../utils/api-response";
import { giftCardAdminService } from "./gift-card-admin.service";
import { giftCardOrderService } from "./gift-card-order.service";

const response = (res: Parameters<typeof sendSuccess>[0], statusCode: number, message: string, data: unknown) =>
  sendSuccess(res, { statusCode, message, data });

const listProducts = catchAsync(async (req, res) => response(res, 200, "Gift cards fetched successfully", await giftCardAdminService.listProducts(req.query as never)));
const getProduct = catchAsync(async (req, res) => response(res, 200, "Gift card fetched successfully", await giftCardAdminService.getProduct(req.params.giftCardId)));
const createProduct = catchAsync(async (req, res) => response(res, 201, "Gift card created successfully", await giftCardAdminService.createProduct(req.authUser!.id, req.body)));
const updateProduct = catchAsync(async (req, res) => response(res, 200, "Gift card updated successfully", await giftCardAdminService.updateProduct(req.authUser!.id, req.params.giftCardId, req.body)));
const archiveProduct = catchAsync(async (req, res) => response(res, 200, "Gift card archived successfully", await giftCardAdminService.archiveProduct(req.authUser!.id, req.params.giftCardId)));

const createDenomination = catchAsync(async (req, res) => response(res, 201, "Denomination created successfully", await giftCardAdminService.createDenomination(req.authUser!.id, req.params.giftCardId, req.body)));
const listDenominations = catchAsync(async (req, res) => response(res, 200, "Denominations fetched successfully", await giftCardAdminService.listDenominations(req.params.giftCardId)));
const updateDenomination = catchAsync(async (req, res) => response(res, 200, "Denomination updated successfully", await giftCardAdminService.updateDenomination(req.authUser!.id, req.params.denominationId, req.body)));
const deleteDenomination = catchAsync(async (req, res) => response(res, 200, "Denomination removed or deactivated successfully", await giftCardAdminService.deleteDenomination(req.authUser!.id, req.params.denominationId)));

const addCode = catchAsync(async (req, res) => response(res, 201, "Inventory code added successfully", await giftCardAdminService.addCode(req.authUser!.id, req.params.denominationId, req.body)));
const addCodesBulk = catchAsync(async (req, res) => response(res, 201, "Inventory codes added successfully", await giftCardAdminService.addCodesBulk(req.authUser!.id, req.params.denominationId, req.body.codes)));
const listCodes = catchAsync(async (req, res) => response(res, 200, "Inventory codes fetched successfully", await giftCardAdminService.listCodes(req.params.denominationId, req.query as never)));
const getCode = catchAsync(async (req, res) => response(res, 200, "Inventory code fetched successfully", await giftCardAdminService.getCode(req.params.codeId)));
const updateCode = catchAsync(async (req, res) => response(res, 200, "Inventory code updated successfully", await giftCardAdminService.updateCode(req.authUser!.id, req.params.codeId, req.body)));
const deleteCode = catchAsync(async (req, res) => response(res, 200, "Inventory code deleted successfully", await giftCardAdminService.deleteCode(req.authUser!.id, req.params.codeId)));
const inventorySummary = catchAsync(async (_req, res) => response(res, 200, "Inventory summary fetched successfully", await giftCardAdminService.inventorySummary()));

const listOrders = catchAsync(async (req, res) => response(res, 200, "Gift card orders fetched successfully", await giftCardOrderService.listForAdmin(req.query as never)));
const getOrder = catchAsync(async (req, res) => response(res, 200, "Gift card order fetched successfully", await giftCardOrderService.getForAdmin(req.params.orderId)));

export const giftCardAdminController = {
  listProducts, getProduct, createProduct, updateProduct, archiveProduct,
  createDenomination, listDenominations, updateDenomination, deleteDenomination,
  addCode, addCodesBulk, listCodes, getCode, updateCode, deleteCode, inventorySummary,
  listOrders, getOrder,
};
