import { Request, Response } from "express";
import ConferenceSeminars from "../../../../models/website/home/ConferenceSeminars.model";
const path = require('path');
const fs = require('fs');

export const createConferenceSeminars = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.checklist === 'string') updateData.checklist = JSON.parse(updateData.checklist);
        if (typeof updateData.button === 'string') updateData.button = JSON.parse(updateData.button);
        if (typeof updateData.eventInfo === 'string') updateData.eventInfo = JSON.parse(updateData.eventInfo);

        if (req.files && req.files.image && req.files.image[0]) {
            updateData.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
        }

        const data = await ConferenceSeminars.create(updateData);
        res.json({ success: true, data, message: 'Conference Seminars created successfully' });
    } catch (error) {
        console.error('Create ConferenceSeminars error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllConferenceSeminars = async (req: Request | any, res: Response | any) => {
    try {
        const data = await ConferenceSeminars.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All ConferenceSeminars error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getConferenceSeminarsById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await ConferenceSeminars.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch ConferenceSeminars by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateConferenceSeminarsById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.checklist === 'string') updateData.checklist = JSON.parse(updateData.checklist);
        if (typeof updateData.button === 'string') updateData.button = JSON.parse(updateData.button);
        if (typeof updateData.eventInfo === 'string') updateData.eventInfo = JSON.parse(updateData.eventInfo);

        if (req.files && req.files.image && req.files.image[0]) {
            updateData.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
        }

        const data = await ConferenceSeminars.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Conference Seminars updated successfully' });
    } catch (error) {
        console.error('Update ConferenceSeminars error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteConferenceSeminarsById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await ConferenceSeminars.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Conference Seminars deleted successfully' });
    } catch (error) {
        console.error('Delete ConferenceSeminars error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
