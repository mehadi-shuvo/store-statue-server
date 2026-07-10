import catchAsync from "../../utils/catchAsync";
import { gameTopUpServices } from "./game-top-up.service";

const getTopUps = catchAsync(async (req, res) => {
  const result = await gameTopUpServices.getTopUps(req.query);

  res.status(200).json({
    success: true,
    message: "Top-up products fetched successfully",
    data: result,
  });
});

const getTopUpById = catchAsync(async (req, res) => {
  const result = await gameTopUpServices.getTopUpById(req.params.id);

  res.status(200).json({
    success: true,
    message: "Top-up product fetched successfully",
    data: result,
  });
});

const createTopUp = catchAsync(async (req, res) => {
  const result = await gameTopUpServices.createTopUp(req.body, req.authUser?.id);

  res.status(201).json({
    success: true,
    message: "Top-up product created successfully",
    data: result,
  });
});

const updateTopUp = catchAsync(async (req, res) => {
  const result = await gameTopUpServices.updateTopUp(
    req.params.id,
    req.body,
    req.authUser?.id,
  );

  res.status(200).json({
    success: true,
    message: "Top-up product updated successfully",
    data: result,
  });
});

const deleteTopUp = catchAsync(async (req, res) => {
  const result = await gameTopUpServices.deleteTopUp(req.params.id);

  res.status(200).json({
    success: true,
    message: "Top-up product deleted successfully",
    data: result,
  });
});

export const gameTopUpControllers = {
  getTopUps,
  getTopUpById,
  createTopUp,
  updateTopUp,
  deleteTopUp,
};
