import { Request, Response } from "express";
import HomeHero from './homeHero.model';

export const createHomeHero = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        if (req.file) {
            updateData.img = `/uploads/organic_expo/${req.file.filename}`;
        }
        const data = await HomeHero.create(updateData);
        res.json({ success: true, data, message: 'Home Hero created successfully' });
    } catch (error) {
        console.error('Create HomeHero error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllHomeHero = async (req: Request | any, res: Response | any) => {
    try {
        const data = await HomeHero.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All HomeHero error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getHomeHeroById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await HomeHero.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch HomeHero by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateHomeHeroById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        if (req.file) {
            updateData.img = `/uploads/organic_expo/${req.file.filename}`;
        }
        const data = await HomeHero.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Home Hero updated successfully' });
    } catch (error) {
        console.error('Update HomeHero error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteHomeHeroById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await HomeHero.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Home Hero deleted successfully' });
    } catch (error) {
        console.error('Delete HomeHero error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
