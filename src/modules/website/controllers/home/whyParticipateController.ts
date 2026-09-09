import { Request, Response } from "express";
import WhyParticipate from "../../../../models/website/home/WhyParticipate.model";
const path = require('path');
const fs = require('fs');

export const createWhyParticipate = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.points === 'string') updateData.points = JSON.parse(updateData.points);
        if (typeof updateData.mainPoints === 'string') updateData.mainPoints = JSON.parse(updateData.mainPoints);
        if (typeof updateData.buttons === 'string') updateData.buttons = JSON.parse(updateData.buttons);

        if (req.files && req.files.image && req.files.image[0]) {
            updateData.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
        }
        
        if (req.files && req.files.brochure && req.files.brochure[0]) {
            if (!updateData.buttons) updateData.buttons = {};
            if (!updateData.buttons.brochure) updateData.buttons.brochure = {};
            updateData.buttons.brochure.link = `/uploads/organic_expo/${req.files.brochure[0].filename}`;
        }

        const data = await WhyParticipate.create(updateData);
        res.json({ success: true, data, message: 'Why Participate created successfully' });
    } catch (error) {
        console.error('Create WhyParticipate error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllWhyParticipate = async (req: Request | any, res: Response | any) => {
    try {
        const data = await WhyParticipate.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All WhyParticipate error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getWhyParticipateById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await WhyParticipate.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch WhyParticipate by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateWhyParticipateById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.points === 'string') updateData.points = JSON.parse(updateData.points);
        if (typeof updateData.mainPoints === 'string') updateData.mainPoints = JSON.parse(updateData.mainPoints);
        if (typeof updateData.buttons === 'string') updateData.buttons = JSON.parse(updateData.buttons);

        if (req.files && req.files.image && req.files.image[0]) {
            updateData.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
        }
        
        if (req.files && req.files.brochure && req.files.brochure[0]) {
            if (!updateData.buttons) updateData.buttons = {};
            if (!updateData.buttons.brochure) updateData.buttons.brochure = {};
            updateData.buttons.brochure.link = `/uploads/organic_expo/${req.files.brochure[0].filename}`;
        }

        const data = await WhyParticipate.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Why Participate updated successfully' });
    } catch (error) {
        console.error('Update WhyParticipate error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteWhyParticipateById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await WhyParticipate.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Why Participate deleted successfully' });
    } catch (error) {
        console.error('Delete WhyParticipate error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
