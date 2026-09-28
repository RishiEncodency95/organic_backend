import { Request, Response } from "express";
import CareerOption, { CAREER_OPTION_TYPES, CareerOptionType } from "../../models/careers/CareerOption.model";

const isOptionType = (value: unknown): value is CareerOptionType =>
  typeof value === "string" && (CAREER_OPTION_TYPES as readonly string[]).includes(value);

const duplicateMessage = (error: any): string | null =>
  error?.code === 11000 ? "This value already exists for the selected type" : null;

/**
 * Public: active options for the application form, grouped by type.
 * Pass ?type=notice_period to get a single list.
 */
export const getCareerOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query;
    const filter: Record<string, unknown> = { isActive: true };
    if (type !== undefined) {
      if (!isOptionType(type)) {
        res.status(400).json({ success: false, message: "Invalid option type" });
        return;
      }
      filter.type = type;
    }

    const options = await CareerOption.find(filter).sort({ order: 1, createdAt: 1 }).lean();

    if (type !== undefined) {
      res.status(200).json({ success: true, data: options });
      return;
    }

    const grouped = Object.fromEntries(CAREER_OPTION_TYPES.map((t) => [t, [] as unknown[]]));
    for (const option of options) grouped[(option as any).type].push(option);
    res.status(200).json({ success: true, data: grouped });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch career options", error: (error as Error).message });
  }
};

export const getAdminCareerOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query;
    const filter: Record<string, unknown> = {};
    if (type !== undefined) {
      if (!isOptionType(type)) {
        res.status(400).json({ success: false, message: "Invalid option type" });
        return;
      }
      filter.type = type;
    }

    const options = await CareerOption.find(filter).sort({ type: 1, order: 1, createdAt: 1 }).lean();
    res.status(200).json({ success: true, data: options });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch career options", error: (error as Error).message });
  }
};

export const createCareerOption = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, label, order, isActive } = req.body ?? {};
    if (!isOptionType(type)) {
      res.status(400).json({ success: false, message: "Invalid option type" });
      return;
    }
    if (typeof label !== "string" || !label.trim()) {
      res.status(400).json({ success: false, message: "Value is required" });
      return;
    }

    const option = await CareerOption.create({
      type,
      label: label.trim(),
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
      isActive: isActive === undefined ? true : Boolean(isActive),
    });
    res.status(201).json({ success: true, message: "Option created successfully", data: option });
  } catch (error) {
    const duplicate = duplicateMessage(error);
    if (duplicate) {
      res.status(409).json({ success: false, message: duplicate });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to create option", error: (error as Error).message });
  }
};

export const updateCareerOption = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, label, order, isActive } = req.body ?? {};
    const update: Record<string, unknown> = {};

    if (type !== undefined) {
      if (!isOptionType(type)) {
        res.status(400).json({ success: false, message: "Invalid option type" });
        return;
      }
      update.type = type;
    }
    if (label !== undefined) {
      if (typeof label !== "string" || !label.trim()) {
        res.status(400).json({ success: false, message: "Value is required" });
        return;
      }
      update.label = label.trim();
    }
    if (order !== undefined && Number.isFinite(Number(order))) update.order = Number(order);
    if (isActive !== undefined) update.isActive = Boolean(isActive);

    const option = await CareerOption.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!option) {
      res.status(404).json({ success: false, message: "Option not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Option updated successfully", data: option });
  } catch (error) {
    const duplicate = duplicateMessage(error);
    if (duplicate) {
      res.status(409).json({ success: false, message: duplicate });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to update option", error: (error as Error).message });
  }
};

export const deleteCareerOption = async (req: Request, res: Response): Promise<void> => {
  try {
    const option = await CareerOption.findByIdAndDelete(req.params.id);
    if (!option) {
      res.status(404).json({ success: false, message: "Option not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Option deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete option", error: (error as Error).message });
  }
};
