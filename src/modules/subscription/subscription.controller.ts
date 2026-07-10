import catchAsync from "../../utils/catchAsync";
import { subscriptionServices } from "./subscription.service";

const getSubscriptions = catchAsync(async (req, res) => {
  const result = await subscriptionServices.getSubscriptions(req.query);

  res.status(200).json({
    success: true,
    message: "Subscription products fetched successfully",
    data: result,
  });
});

const getSubscriptionById = catchAsync(async (req, res) => {
  const result = await subscriptionServices.getSubscriptionById(req.params.id);

  res.status(200).json({
    success: true,
    message: "Subscription product fetched successfully",
    data: result,
  });
});

const createSubscription = catchAsync(async (req, res) => {
  const result = await subscriptionServices.createSubscription(
    req.body,
    req.authUser?.id,
  );

  res.status(201).json({
    success: true,
    message: "Subscription product created successfully",
    data: result,
  });
});

const updateSubscription = catchAsync(async (req, res) => {
  const result = await subscriptionServices.updateSubscription(
    req.params.id,
    req.body,
    req.authUser?.id,
  );

  res.status(200).json({
    success: true,
    message: "Subscription product updated successfully",
    data: result,
  });
});

const deleteSubscription = catchAsync(async (req, res) => {
  const result = await subscriptionServices.deleteSubscription(req.params.id);

  res.status(200).json({
    success: true,
    message: "Subscription product deleted successfully",
    data: result,
  });
});

export const subscriptionControllers = {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
};
