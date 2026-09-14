import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getNominationSidebarService,
  updateNominationSidebarService,
} from "./awardsNominationSidebar.service";

export const getNominationSidebar = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getNominationSidebarService();
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Awards nomination sidebar info fetched successfully",
          data
        )
      );
  }
);

export const updateNominationSidebar = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateNominationSidebarService(req.body);
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Awards nomination sidebar info updated successfully",
          data
        )
      );
  }
);
