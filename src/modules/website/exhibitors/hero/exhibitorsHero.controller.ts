import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import { getExhibitorsHeroService, updateExhibitorsHeroService } from "./exhibitorsHero.service";

export const getExhibitorsHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getExhibitorsHeroService();
  res.status(200).json(new ApiResponse(200, "Exhibitors Hero fetched successfully", data));
});

export const updateExhibitorsHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateExhibitorsHeroService(req.body);
  res.status(200).json(new ApiResponse(200, "Exhibitors Hero updated successfully", data));
});
