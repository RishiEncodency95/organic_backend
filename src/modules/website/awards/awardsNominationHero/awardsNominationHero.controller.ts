import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAwardsNominationHeroService,
  updateAwardsNominationHeroService,
} from "./awardsNominationHero.service";

export const getAwardsNominationHero = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getAwardsNominationHeroService();
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Awards Nomination Hero fetched successfully",
          data
        )
      );
  }
);

export const updateAwardsNominationHero = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateAwardsNominationHeroService(req.body);
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Awards Nomination Hero updated successfully",
          data
        )
      );
  }
);
