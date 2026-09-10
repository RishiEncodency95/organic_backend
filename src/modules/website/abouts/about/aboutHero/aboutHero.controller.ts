import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAboutHeroService,
  updateAboutHeroService,
} from "./aboutHero.service";

export const getAboutHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAboutHeroService();
  res.status(200).json(new ApiResponse(200, "About Hero fetched successfully", data));
});

export const updateAboutHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAboutHeroService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "About Hero updated successfully", data));
});
