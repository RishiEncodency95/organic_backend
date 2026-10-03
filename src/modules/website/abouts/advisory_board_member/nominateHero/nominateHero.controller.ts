import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getNominateHeroService, updateNominateHeroService } from "./nominateHero.service";

export const getNominateHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getNominateHeroService();
  res.status(200).json(new ApiResponse(200, "Nominate Advisory Hero fetched successfully", data));
});

export const updateNominateHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateNominateHeroService(req.body);
  res.status(200).json(new ApiResponse(200, "Nominate Advisory Hero updated successfully", data));
});
