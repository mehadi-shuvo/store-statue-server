import catchAsync from "../../utils/catchAsync";
import { gameTopUpOrderService } from "./game-top-up-order.service";

const create = catchAsync(async (req, res) => {
  const data = await gameTopUpOrderService.createOrder(req.authUser!.id, req.body);
  res.status(201).json({ success: true, message: "Top-up order created; complete payment to start fulfillment", data });
});

const list = catchAsync(async (req, res) => {
  const data = await gameTopUpOrderService.listForCustomer(req.authUser!.id, req.query as never);
  res.status(200).json({ success: true, message: "Top-up orders fetched successfully", data });
});

const get = catchAsync(async (req, res) => {
  const data = await gameTopUpOrderService.getForCustomer(req.authUser!.id, req.params.orderId);
  res.status(200).json({ success: true, message: "Top-up order fetched successfully", data });
});

const cancel = catchAsync(async (req, res) => {
  const data = await gameTopUpOrderService.cancel(req.authUser!.id, req.params.orderId);
  res.status(200).json({ success: true, message: "Top-up order cancelled successfully", data });
});

export const gameTopUpOrderController = { create, list, get, cancel };
