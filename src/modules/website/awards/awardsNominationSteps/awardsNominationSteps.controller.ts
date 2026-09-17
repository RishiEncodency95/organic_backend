import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAwardsNominationStepsService,
  updateAwardsNominationStepsService,
} from "./awardsNominationSteps.service";

export const getAwardsNominationSteps = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getAwardsNominationStepsService();
    res
      .status(200)
      .json(new ApiResponse(200, "Awards Nomination Steps fetched successfully", data));
  }
);

export const updateAwardsNominationSteps = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateAwardsNominationStepsService(req.body);
    res
      .status(200)
      .json(new ApiResponse(200, "Awards Nomination Steps updated successfully", data));
  }
);
