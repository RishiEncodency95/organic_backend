import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getWhyExhibitTestimonialsService,
  updateWhyExhibitTestimonialsService,
} from "./whyExhibitTestimonials.service";

export const getWhyExhibitTestimonials = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyExhibitTestimonialsService();
  res.status(200).json(new ApiResponse(200, "Exhibitor testimonials fetched successfully", data));
});

export const updateWhyExhibitTestimonials = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyExhibitTestimonialsService(req.body);
  res.status(200).json(new ApiResponse(200, "Exhibitor testimonials updated successfully", data));
});
