import { ApiAppError } from "../../../utils/apiAppError";
import catchAsync from "../../../utils/catchAsync";
import { ENV } from "../../../utils/env-config";
import { paymentService } from "../services/payment-service.factory";

const getAuthUserId = (userId?: string) => {
  if (!userId) throw new ApiAppError(401, "Authentication token is required");
  return userId;
};
const createPayment = catchAsync(async (req, res) => {
  const data = await paymentService.createPayment(req.body, getAuthUserId(req.authUser?.id));
  res.status(201).json({ success: true, message: "Payment initialized successfully", data });
});
const executePayment = catchAsync(async (req, res) => {
  const data = await paymentService.executePayment(req.body.paymentId, getAuthUserId(req.authUser?.id));
  res.status(200).json({ success: true, message: "Payment verification checked", data });
});
const getPaymentStatus = catchAsync(async (req, res) => {
  const data = await paymentService.getPaymentStatus(req.params.paymentId, getAuthUserId(req.authUser?.id));
  res.status(200).json({ success: true, message: "Payment status fetched successfully", data });
});
const aamarpayCallback = catchAsync(async (req, res) => {
  const bodyId = req.body?.mer_txnid as string | undefined;
  const queryId = req.query.transactionId as string | undefined;
  if ((!bodyId && !queryId) || (bodyId && queryId && bodyId !== queryId)) throw new ApiAppError(400, "A matching transaction identifier is required");
  const result = await paymentService.handleCallback(bodyId || queryId!);
  const target = new URL(`${ENV.FRONTEND_URL}/payment/${result.outcome}`);
  if (result.orderId) target.searchParams.set("orderId", result.orderId);
  // POST callbacks become GET navigation, avoiding body resubmission to the frontend.
  res.redirect(303, target.toString());
});
export const paymentController = { createPayment, executePayment, getPaymentStatus, aamarpayCallback };
