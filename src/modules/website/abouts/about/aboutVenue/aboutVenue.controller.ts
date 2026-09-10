import { Request, Response } from "express";
import AboutVenue from './aboutVenue.model';

export const createAboutVenue = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await AboutVenue.create(updateData);
        res.json({ success: true, data, message: 'AboutVenue created successfully' });
    } catch (error) {
        console.error('Create AboutVenue error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllAboutVenue = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutVenue.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All AboutVenue error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAboutVenueById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutVenue.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch AboutVenue by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateAboutVenueById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await AboutVenue.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'AboutVenue updated successfully' });
    } catch (error) {
        console.error('Update AboutVenue error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteAboutVenueById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutVenue.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'AboutVenue deleted successfully' });
    } catch (error) {
        console.error('Delete AboutVenue error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
