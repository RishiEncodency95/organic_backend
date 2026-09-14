import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  createNominationService,
  getAllNominationsService,
  getNominationByIdService,
  updateNominationService,
  deleteNominationService,
} from "./awardsNomination.service";

export const submitNomination = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await createNominationService(req.body, req.files);
    res
      .status(201)
      .json(
        new ApiResponse(201, "Award nomination submitted successfully", data)
      );
  }
);

export const getAllNominations = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getAllNominationsService(req.query);
    res
      .status(200)
      .json(new ApiResponse(200, "Award nominations fetched successfully", data));
  }
);

export const getNominationById = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await getNominationByIdService(id);
    if (!data) {
      res.status(404).json(new ApiResponse(404, "Nomination not found", null));
      return;
    }
    res
      .status(200)
      .json(new ApiResponse(200, "Nomination details fetched successfully", data));
  }
);

export const updateNomination = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await updateNominationService(id, req.body);
    res
      .status(200)
      .json(new ApiResponse(200, "Nomination updated successfully", data));
  }
);

export const deleteNomination = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await deleteNominationService(id);
    res
      .status(200)
      .json(new ApiResponse(200, "Nomination deleted successfully", data));
  }
);
