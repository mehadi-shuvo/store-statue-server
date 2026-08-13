import { ApiAppError } from "../../../utils/apiAppError";
import catchAsync from "../../../utils/catchAsync";
import { paymentService } from "../services/payment-service.factory";

const getAuthUserId = (userId?: string) => {
  if (!userId) {
    throw new ApiAppError(401, "Authentication token is required");
  }

  return userId;
};

const createPayment = catchAsync(async (req, res) => {
  const result = await paymentService.createPayment(
    req.body,
    getAuthUserId(req.authUser?.id),
  );

  res.status(201).json({
    success: true,
    message: "Payment created successfully",
    data: result,
  });
});

const executePayment = catchAsync(async (req, res) => {
  const result = await paymentService.executePayment(
    req.body.paymentId,
    getAuthUserId(req.authUser?.id),
    req.query,
  );

  res.status(200).json({
    success: true,
    message: "Payment executed successfully",
    data: result,
  });
});

const getPaymentStatus = catchAsync(async (req, res) => {
  const result = await paymentService.getPaymentStatus(
    req.params.paymentId,
    getAuthUserId(req.authUser?.id),
  );

  res.status(200).json({
    success: true,
    message: "Payment status fetched successfully",
    data: result,
  });
});

export const paymentController = {
  createPayment,
  executePayment,
  getPaymentStatus,
};
