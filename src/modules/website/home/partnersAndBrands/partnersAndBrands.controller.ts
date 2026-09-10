import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getPartnersAndBrandsService,
  updatePartnersAndBrandsService,
  createPartnersAndBrandsService,
  getAllPartnersAndBrandsService,
  getPartnersAndBrandsByIdService,
  updatePartnersAndBrandsByIdService,
  deletePartnersAndBrandsByIdService,
} from "./partnersAndBrands.service";

export const getPartnersAndBrands = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getPartnersAndBrandsService();
  res.status(200).json(new ApiResponse(200, "Partners and Brands fetched successfully", data));
});

export const updatePartnersAndBrands = asyncHandler(async (req: Request, res: Response) => {
  const data = await updatePartnersAndBrandsService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Partners and Brands updated successfully", data));
});

export const createPartnersAndBrands = asyncHandler(async (req: Request, res: Response) => {
  const data = await createPartnersAndBrandsService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Partners and Brands created successfully", data));
});

export const getAllPartnersAndBrands = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllPartnersAndBrandsService();
  res.status(200).json(new ApiResponse(200, "Partners and Brands list fetched successfully", data));
});

export const getPartnersAndBrandsById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await getPartnersAndBrandsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Partners and Brands fetched successfully", data));
});

export const updatePartnersAndBrandsById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await updatePartnersAndBrandsByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Partners and Brands updated successfully", data));
});

export const deletePartnersAndBrandsById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await deletePartnersAndBrandsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Partners and Brands deleted successfully", data));
});
