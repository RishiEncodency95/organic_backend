import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getTestimonialsCarouselService,
  updateTestimonialsCarouselService,
} from "./testimonialsCarousel.service";

export const getTestimonialsCarousel = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getTestimonialsCarouselService();
  res.status(200).json(new ApiResponse(200, "Testimonials fetched successfully", data));
});

export const updateTestimonialsCarousel = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateTestimonialsCarouselService(req.body);
  res.status(200).json(new ApiResponse(200, "Testimonials updated successfully", data));
});
