import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getGalleryCountersService,
  updateGalleryCountersService,
} from "./galleryCounters.service";

export const getGalleryCounters = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getGalleryCountersService();
    return res
      .status(200)
      .json(new ApiResponse(200, "Gallery Counters fetched successfully", data));
  }
);

export const updateGalleryCounters = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateGalleryCountersService(req.body);
    return res
      .status(200)
      .json(new ApiResponse(200, "Gallery Counters updated successfully", data));
  }
);
