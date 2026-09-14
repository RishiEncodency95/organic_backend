import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAwardsCtaService,
  updateAwardsCtaService,
} from "./awardsCta.service";

export const getAwardsCta = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getAwardsCtaService();
    res
      .status(200)
      .json(new ApiResponse(200, "Awards CTA fetched successfully", data));
  }
);

export const updateAwardsCta = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateAwardsCtaService(req.body);
    res
      .status(200)
      .json(new ApiResponse(200, "Awards CTA updated successfully", data));
  }
);
