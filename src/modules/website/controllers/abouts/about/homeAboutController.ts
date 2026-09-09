import { Request, Response } from "express";
import HomeAbout from "../../../../../models/website/abouts/about/HomeAbout.model";

export const createHomeAbout = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await HomeAbout.create(updateData);
        res.json({ success: true, data, message: 'HomeAbout created successfully' });
    } catch (error) {
        console.error('Create HomeAbout error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllHomeAbout = async (req: Request | any, res: Response | any) => {
    try {
        const data = await HomeAbout.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All HomeAbout error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getHomeAboutById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await HomeAbout.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch HomeAbout by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateHomeAboutById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await HomeAbout.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'HomeAbout updated successfully' });
    } catch (error) {
        console.error('Update HomeAbout error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteHomeAboutById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await HomeAbout.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'HomeAbout deleted successfully' });
    } catch (error) {
        console.error('Delete HomeAbout error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
