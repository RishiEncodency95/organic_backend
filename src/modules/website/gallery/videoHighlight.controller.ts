import { Request, Response } from "express";
import mongoose from "mongoose";
import * as videoHighlightService from "./videoHighlight.service";

export const getItems = async (req: Request, res: Response) => {
  try {
    const items = await videoHighlightService.getVideoHighlights();
    return res.status(200).json({
      status: "success",
      count: items.length,
      data: items,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch video highlights",
    });
  }
};

export const createItem = async (req: Request, res: Response) => {
  try {
    const item = await videoHighlightService.createVideoHighlight(req.body);
    return res.status(201).json({
      status: "success",
      data: item,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create video highlight",
    });
  }
};

export const updateItem = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await videoHighlightService.updateVideoHighlight(id, req.body);
    if (!item) {
      return res.status(404).json({
        status: "fail",
        message: "Video highlight not found",
      });
    }
    return res.status(200).json({
      status: "success",
      data: item,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update video highlight",
    });
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const item = await videoHighlightService.updateVideoHighlightStatus(id, status);
    if (!item) {
      return res.status(404).json({
        status: "fail",
        message: "Video highlight not found",
      });
    }
    return res.status(200).json({
      status: "success",
      data: item,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update status",
    });
  }
};

export const deleteItem = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await videoHighlightService.deleteVideoHighlight(id);
    if (!item) {
      return res.status(404).json({
        status: "fail",
        message: "Video highlight not found",
      });
    }
    return res.status(200).json({
      status: "success",
      message: "Video highlight deleted successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to delete video highlight",
    });
  }
};

export const bulkDeleteItems = async (req: Request, res: Response) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string" && mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        status: "fail",
        message: "Provide a non-empty array of valid video highlight ids in `ids`.",
      });
    }
    const deletedCount = await videoHighlightService.bulkDeleteVideoHighlights(ids);
    return res.status(200).json({
      status: "success",
      deletedCount,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to delete video highlights",
    });
  }
};
