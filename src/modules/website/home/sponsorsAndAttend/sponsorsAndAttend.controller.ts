import { Request, Response } from "express";
import SponsorsAndAttend from './sponsorsAndAttend.model';

export const createSponsorsAndAttend = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.leftSection === 'string') updateData.leftSection = JSON.parse(updateData.leftSection);
        if (typeof updateData.centerSection === 'string') updateData.centerSection = JSON.parse(updateData.centerSection);
        if (typeof updateData.rightSection === 'string') updateData.rightSection = JSON.parse(updateData.rightSection);

        const data = await SponsorsAndAttend.create(updateData);
        res.json({ success: true, data, message: 'Sponsors and Attend created successfully' });
    } catch (error) {
        console.error('Create SponsorsAndAttend error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllSponsorsAndAttend = async (req: Request | any, res: Response | any) => {
    try {
        const data = await SponsorsAndAttend.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All SponsorsAndAttend error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getSponsorsAndAttendById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await SponsorsAndAttend.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch SponsorsAndAttend by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateSponsorsAndAttendById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.leftSection === 'string') updateData.leftSection = JSON.parse(updateData.leftSection);
        if (typeof updateData.centerSection === 'string') updateData.centerSection = JSON.parse(updateData.centerSection);
        if (typeof updateData.rightSection === 'string') updateData.rightSection = JSON.parse(updateData.rightSection);

        const data = await SponsorsAndAttend.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Sponsors and Attend updated successfully' });
    } catch (error) {
        console.error('Update SponsorsAndAttend error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteSponsorsAndAttendById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await SponsorsAndAttend.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Sponsors and Attend deleted successfully' });
    } catch (error) {
        console.error('Delete SponsorsAndAttend error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
