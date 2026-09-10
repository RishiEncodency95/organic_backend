import { Request, Response } from "express";
import AboutStrip from './aboutStrip.model';

export const createAboutStrip = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await AboutStrip.create(updateData);
        res.json({ success: true, data, message: 'AboutStrip created successfully' });
    } catch (error) {
        console.error('Create AboutStrip error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllAboutStrip = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutStrip.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All AboutStrip error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAboutStripById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutStrip.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch AboutStrip by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateAboutStripById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await AboutStrip.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'AboutStrip updated successfully' });
    } catch (error) {
        console.error('Update AboutStrip error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteAboutStripById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutStrip.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'AboutStrip deleted successfully' });
    } catch (error) {
        console.error('Delete AboutStrip error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
