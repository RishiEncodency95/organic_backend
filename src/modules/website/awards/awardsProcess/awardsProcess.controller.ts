import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAwardsProcessService,
  updateAwardsProcessService,
} from "./awardsProcess.service";

export const getAwardsProcess = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getAwardsProcessService();
    res
      .status(200)
      .json(new ApiResponse(200, "Awards Process fetched successfully", data));
  }
);

export const updateAwardsProcess = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateAwardsProcessService(req.body);
    res
      .status(200)
      .json(new ApiResponse(200, "Awards Process updated successfully", data));
  }
);
