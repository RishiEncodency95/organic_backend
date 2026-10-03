import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getExhibitionCategoriesHeroService,
  updateExhibitionCategoriesHeroService,
} from "./exhibitionCategoriesHero.service";

export const getExhibitionCategoriesHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getExhibitionCategoriesHeroService();
  res.status(200).json(new ApiResponse(200, "Exhibition Categories Hero fetched successfully", data));
});

export const updateExhibitionCategoriesHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateExhibitionCategoriesHeroService(req.body);
  res.status(200).json(new ApiResponse(200, "Exhibition Categories Hero updated successfully", data));
});
