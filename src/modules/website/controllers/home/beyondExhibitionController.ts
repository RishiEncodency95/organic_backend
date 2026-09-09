import { Request, Response } from "express";
import BeyondExhibition from "../../../../models/website/home/BeyondExhibition.model";
const path = require('path');
const fs = require('fs');

export const createBeyondExhibition = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.extras === 'string') {
            updateData.extras = JSON.parse(updateData.extras);
        }

        if (req.files && req.files.image && req.files.image[0]) {
            updateData.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
        }

        const data = await BeyondExhibition.create(updateData);
        res.json({ success: true, data, message: 'Beyond Exhibition created successfully' });
    } catch (error) {
        console.error('Create BeyondExhibition error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllBeyondExhibition = async (req: Request | any, res: Response | any) => {
    try {
        const data = await BeyondExhibition.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All BeyondExhibition error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getBeyondExhibitionById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await BeyondExhibition.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch BeyondExhibition by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateBeyondExhibitionById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.extras === 'string') {
            updateData.extras = JSON.parse(updateData.extras);
        }

        if (req.files && req.files.image && req.files.image[0]) {
            updateData.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
        }

        const data = await BeyondExhibition.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Beyond Exhibition updated successfully' });
    } catch (error) {
        console.error('Update BeyondExhibition error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteBeyondExhibitionById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await BeyondExhibition.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Beyond Exhibition deleted successfully' });
    } catch (error) {
        console.error('Delete BeyondExhibition error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
