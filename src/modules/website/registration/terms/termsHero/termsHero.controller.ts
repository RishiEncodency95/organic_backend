import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getTermsHeroService,
  updateTermsHeroService,
} from "./termsHero.service";

export const getTermsHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getTermsHeroService();
  res.status(200).json(new ApiResponse(200, "Terms Hero fetched successfully", data));
});

export const updateTermsHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateTermsHeroService(req.body);
  res.status(200).json(new ApiResponse(200, "Terms Hero updated successfully", data));
});
