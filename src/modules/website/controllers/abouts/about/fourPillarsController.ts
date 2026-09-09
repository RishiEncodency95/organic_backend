import { Request, Response } from "express";
import FourPillars from "../../../../../models/website/abouts/about/FourPillars.model";

export const createFourPillars = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await FourPillars.create(updateData);
        res.json({ success: true, data, message: 'FourPillars created successfully' });
    } catch (error) {
        console.error('Create FourPillars error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllFourPillars = async (req: Request | any, res: Response | any) => {
    try {
        const data = await FourPillars.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All FourPillars error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getFourPillarsById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await FourPillars.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch FourPillars by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateFourPillarsById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await FourPillars.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'FourPillars updated successfully' });
    } catch (error) {
        console.error('Update FourPillars error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteFourPillarsById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await FourPillars.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'FourPillars deleted successfully' });
    } catch (error) {
        console.error('Delete FourPillars error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
