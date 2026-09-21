import catchAsync from "../../utils/catchAsync";
import { gameTopUpServices } from "./game-top-up.service";

const listGames = catchAsync(async (req, res) => {
  const data = await gameTopUpServices.listPublicGames(req.query as never);
  res.status(200).json({ success: true, message: "Games fetched successfully", data });
});

const getGame = catchAsync(async (req, res) => {
  const data = await gameTopUpServices.getPublicGame(req.params.slug);
  res.status(200).json({ success: true, message: "Game fetched successfully", data });
});

const listPackages = catchAsync(async (req, res) => {
  const data = await gameTopUpServices.listPublicPackages(req.params.gameId);
  res.status(200).json({ success: true, message: "Top-up packages fetched successfully", data });
});

const listAccountFields = catchAsync(async (req, res) => {
  const data = await gameTopUpServices.listPublicAccountFields(req.params.gameId);
  res.status(200).json({ success: true, message: "Account fields fetched successfully", data });
});

// Old names remain aliases for callers of the pre-existing module.
export const gameTopUpControllers = {
  listGames, getGame, listPackages, listAccountFields,
  getTopUps: listGames,
  getTopUpById: getGame,
};
