import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAwardsHeroService,
  updateAwardsHeroService,
} from "./awardsHero.service";

export const getAwardsHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAwardsHeroService();
  res.status(200).json(new ApiResponse(200, "Awards Hero fetched successfully", data));
});

export const updateAwardsHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAwardsHeroService(req.body);
  res.status(200).json(new ApiResponse(200, "Awards Hero updated successfully", data));
});
