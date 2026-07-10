import catchAsync from "../../utils/catchAsync";
import { giftCardServices } from "./gift-card.service";

const getGiftCards = catchAsync(async (req, res) => {
  const result = await giftCardServices.getGiftCards(req.query);

  res.status(200).json({
    success: true,
    message: "Gift cards fetched successfully",
    data: result,
  });
});

const getGiftCardById = catchAsync(async (req, res) => {
  const result = await giftCardServices.getGiftCardById(req.params.id);

  res.status(200).json({
    success: true,
    message: "Gift card fetched successfully",
    data: result,
  });
});

const createGiftCard = catchAsync(async (req, res) => {
  const result = await giftCardServices.createGiftCard(req.body, req.authUser?.id);

  res.status(201).json({
    success: true,
    message: "Gift card created successfully",
    data: result,
  });
});

const updateGiftCard = catchAsync(async (req, res) => {
  const result = await giftCardServices.updateGiftCard(
    req.params.id,
    req.body,
    req.authUser?.id,
  );

  res.status(200).json({
    success: true,
    message: "Gift card updated successfully",
    data: result,
  });
});

const deleteGiftCard = catchAsync(async (req, res) => {
  const result = await giftCardServices.deleteGiftCard(req.params.id);

  res.status(200).json({
    success: true,
    message: "Gift card deleted successfully",
    data: result,
  });
});

export const giftCardControllers = {
  getGiftCards,
  getGiftCardById,
  createGiftCard,
  updateGiftCard,
  deleteGiftCard,
};
