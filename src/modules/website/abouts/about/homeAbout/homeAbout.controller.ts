import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getHomeAboutService,
  updateHomeAboutService,
} from "./homeAbout.service";

export const getHomeAbout = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getHomeAboutService();
  res.status(200).json(new ApiResponse(200, "Home About fetched successfully", data));
});

export const updateHomeAbout = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateHomeAboutService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Home About updated successfully", data));
});
