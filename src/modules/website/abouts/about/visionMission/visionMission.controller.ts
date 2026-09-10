import { Request, Response } from "express";
import VisionMission from './visionMission.model';

export const createVisionMission = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await VisionMission.create(updateData);
        res.json({ success: true, data, message: 'VisionMission created successfully' });
    } catch (error) {
        console.error('Create VisionMission error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllVisionMission = async (req: Request | any, res: Response | any) => {
    try {
        const data = await VisionMission.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All VisionMission error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getVisionMissionById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await VisionMission.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch VisionMission by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateVisionMissionById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await VisionMission.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'VisionMission updated successfully' });
    } catch (error) {
        console.error('Update VisionMission error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteVisionMissionById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await VisionMission.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'VisionMission deleted successfully' });
    } catch (error) {
        console.error('Delete VisionMission error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
