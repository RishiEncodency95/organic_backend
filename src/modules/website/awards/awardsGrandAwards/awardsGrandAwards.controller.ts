import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAwardsGrandAwardsService,
  updateAwardsGrandAwardsService,
} from "./awardsGrandAwards.service";

export const getAwardsGrandAwards = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getAwardsGrandAwardsService();
    res
      .status(200)
      .json(new ApiResponse(200, "Awards Grand Awards fetched successfully", data));
  }
);

export const updateAwardsGrandAwards = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateAwardsGrandAwardsService(req.body);
    res
      .status(200)
      .json(new ApiResponse(200, "Awards Grand Awards updated successfully", data));
  }
);
