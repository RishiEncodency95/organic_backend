import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import { getGalleryHeroService, updateGalleryHeroService } from "./galleryHero.service";

export const getGalleryHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getGalleryHeroService();
  res.status(200).json(new ApiResponse(200, "Gallery Hero fetched successfully", data));
});

export const updateGalleryHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateGalleryHeroService(req.body);
  res.status(200).json(new ApiResponse(200, "Gallery Hero updated successfully", data));
});
