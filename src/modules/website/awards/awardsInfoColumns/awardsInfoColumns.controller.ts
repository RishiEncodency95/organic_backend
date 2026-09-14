import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAwardsInfoColumnsService,
  updateAwardsInfoColumnsService,
} from "./awardsInfoColumns.service";

export const getAwardsInfoColumns = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getAwardsInfoColumnsService();
    res
      .status(200)
      .json(
        new ApiResponse(200, "Awards Info Columns fetched successfully", data)
      );
  }
);

export const updateAwardsInfoColumns = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateAwardsInfoColumnsService(req.body);
    res
      .status(200)
      .json(
        new ApiResponse(200, "Awards Info Columns updated successfully", data)
      );
  }
);
