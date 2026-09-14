import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAwardsCelebratingLeadersService,
  updateAwardsCelebratingLeadersService,
} from "./awardsCelebratingLeaders.service";

export const getAwardsCelebratingLeaders = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getAwardsCelebratingLeadersService();
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Awards Celebrating Leaders fetched successfully",
          data
        )
      );
  }
);

export const updateAwardsCelebratingLeaders = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateAwardsCelebratingLeadersService(req.body);
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Awards Celebrating Leaders updated successfully",
          data
        )
      );
  }
);
