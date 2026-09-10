import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAdvisoryHeroService,
  updateAdvisoryHeroService,
} from "./advisoryHero.service";

export const getAdvisoryHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdvisoryHeroService();
  res.status(200).json(new ApiResponse(200, "Advisory Hero fetched successfully", data));
});

export const updateAdvisoryHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAdvisoryHeroService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Advisory Hero updated successfully", data));
});
