import { Request, Response } from "express";
import mongoose from "mongoose";
import * as galleryService from "./gallery.service";

export const getItems = async (req: Request, res: Response) => {
  try {
    const items = await galleryService.getGalleryItems();
    return res.status(200).json({
      status: "success",
      count: items.length,
      data: items,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch gallery items",
    });
  }
};

export const createItem = async (req: Request, res: Response) => {
  try {
    const item = await galleryService.createGalleryItem(req.body);
    return res.status(201).json({
      status: "success",
      data: item,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create gallery item",
    });
  }
};

export const updateItem = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await galleryService.updateGalleryItem(id, req.body);
    if (!item) {
      return res.status(404).json({
        status: "fail",
        message: "Gallery item not found",
      });
    }
    return res.status(200).json({
      status: "success",
      data: item,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update gallery item",
    });
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const item = await galleryService.updateGalleryItemStatus(id, status);
    if (!item) {
      return res.status(404).json({
        status: "fail",
        message: "Gallery item not found",
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
    const item = await galleryService.deleteGalleryItem(id);
    if (!item) {
      return res.status(404).json({
        status: "fail",
        message: "Gallery item not found",
      });
    }
    return res.status(200).json({
      status: "success",
      message: "Gallery item deleted successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to delete gallery item",
    });
  }
};

export const bulkDeleteItems = async (req: Request, res: Response) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string" && mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        status: "fail",
        message: "Provide a non-empty array of valid gallery item ids in `ids`.",
      });
    }
    const deletedCount = await galleryService.bulkDeleteGalleryItems(ids);
    return res.status(200).json({
      status: "success",
      deletedCount,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to delete gallery items",
    });
  }
};

export const getMeta = async (req: Request, res: Response) => {
  try {
    const meta = await galleryService.getGalleryMeta();
    return res.status(200).json({
      status: "success",
      data: meta,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch gallery metadata",
    });
  }
};

export const saveMeta = async (req: Request, res: Response) => {
  try {
    const { categories, years } = req.body;
    const meta = await galleryService.saveGalleryMeta(categories, years);
    return res.status(200).json({
      status: "success",
      data: meta,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to save gallery metadata",
    });
  }
};
