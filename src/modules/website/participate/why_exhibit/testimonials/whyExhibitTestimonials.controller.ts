import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAllWhyExhibitTestimonialsService,
  createWhyExhibitTestimonialsService,
  getWhyExhibitTestimonialsByIdService,
  updateWhyExhibitTestimonialsByIdService,
  deleteWhyExhibitTestimonialsByIdService,
} from "./whyExhibitTestimonials.service";

export const getAllWhyExhibitTestimonials = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyExhibitTestimonialsService();
  res.status(200).json(new ApiResponse(200, "Why Exhibit testimonials fetched successfully", data));
});

export const createWhyExhibitTestimonials = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyExhibitTestimonialsService(req.body);
  res.status(201).json(new ApiResponse(201, "Testimonial created successfully", data));
});

export const getWhyExhibitTestimonialsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyExhibitTestimonialsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Testimonial fetched successfully", data));
});

export const updateWhyExhibitTestimonialsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyExhibitTestimonialsByIdService(id, req.body);
  res.status(200).json(new ApiResponse(200, "Testimonial updated successfully", data));
});

export const deleteWhyExhibitTestimonialsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyExhibitTestimonialsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Testimonial deleted successfully", data));
});
