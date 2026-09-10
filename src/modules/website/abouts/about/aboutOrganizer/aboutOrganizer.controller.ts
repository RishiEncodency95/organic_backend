import { Request, Response } from "express";
import AboutOrganizer from './aboutOrganizer.model';

export const createAboutOrganizer = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await AboutOrganizer.create(updateData);
        res.json({ success: true, data, message: 'AboutOrganizer created successfully' });
    } catch (error) {
        console.error('Create AboutOrganizer error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllAboutOrganizer = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutOrganizer.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All AboutOrganizer error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAboutOrganizerById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutOrganizer.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch AboutOrganizer by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateAboutOrganizerById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await AboutOrganizer.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'AboutOrganizer updated successfully' });
    } catch (error) {
        console.error('Update AboutOrganizer error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteAboutOrganizerById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutOrganizer.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'AboutOrganizer deleted successfully' });
    } catch (error) {
        console.error('Delete AboutOrganizer error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
