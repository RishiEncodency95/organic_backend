import { Request, Response } from "express";
import EventOverview from './eventOverview.model';

export const createEventOverview = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await EventOverview.create(updateData);
        res.json({ success: true, data, message: 'EventOverview created successfully' });
    } catch (error) {
        console.error('Create EventOverview error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllEventOverview = async (req: Request | any, res: Response | any) => {
    try {
        const data = await EventOverview.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All EventOverview error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getEventOverviewById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await EventOverview.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch EventOverview by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateEventOverviewById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await EventOverview.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'EventOverview updated successfully' });
    } catch (error) {
        console.error('Update EventOverview error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteEventOverviewById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await EventOverview.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'EventOverview deleted successfully' });
    } catch (error) {
        console.error('Delete EventOverview error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
