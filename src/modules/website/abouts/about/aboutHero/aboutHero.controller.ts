import { Request, Response } from "express";
import AboutHero from './aboutHero.model';

export const createAboutHero = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await AboutHero.create(updateData);
        res.json({ success: true, data, message: 'AboutHero created successfully' });
    } catch (error) {
        console.error('Create AboutHero error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllAboutHero = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutHero.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All AboutHero error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAboutHeroById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutHero.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch AboutHero by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateAboutHeroById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await AboutHero.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'AboutHero updated successfully' });
    } catch (error) {
        console.error('Update AboutHero error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteAboutHeroById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutHero.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'AboutHero deleted successfully' });
    } catch (error) {
        console.error('Delete AboutHero error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
