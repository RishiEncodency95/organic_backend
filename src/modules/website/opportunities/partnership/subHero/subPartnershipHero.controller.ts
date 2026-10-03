import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getSubPartnershipHeroService, updateSubPartnershipHeroService } from "./subPartnershipHero.service";

export const getSubPartnershipHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await getSubPartnershipHeroService(req.params.slug as string);
  res.status(200).json(new ApiResponse(200, "Partnership page hero fetched successfully", data));
});

export const updateSubPartnershipHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateSubPartnershipHeroService(req.params.slug as string, req.body);
  res.status(200).json(new ApiResponse(200, "Partnership page hero updated successfully", data));
});
