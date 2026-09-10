import { Request, Response } from "express";
import GlobalPlatform from './globalPlatform.model';
const path = require('path');
const fs = require('fs');

export const createGlobalPlatform = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.title === 'string') updateData.title = JSON.parse(updateData.title);
        if (typeof updateData.listItems === 'string') updateData.listItems = JSON.parse(updateData.listItems);
        if (typeof updateData.cards === 'string') updateData.cards = JSON.parse(updateData.cards);

        if (req.files && updateData.cards) {
            for (let i = 0; i < updateData.cards.length; i++) {
                const fieldName = `icon${i}`;
                if (req.files[fieldName]) {
                    updateData.cards[i].iconSrc = `/uploads/organic_expo/${req.files[fieldName][0].filename}`;
                }
            }
        }
        
        const data = await GlobalPlatform.create(updateData);
        res.json({ success: true, data, message: 'Global Platform created successfully' });
    } catch (error) {
        console.error('Create GlobalPlatform error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllGlobalPlatform = async (req: Request | any, res: Response | any) => {
    try {
        const data = await GlobalPlatform.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All GlobalPlatform error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getGlobalPlatformById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await GlobalPlatform.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch GlobalPlatform by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateGlobalPlatformById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.title === 'string') updateData.title = JSON.parse(updateData.title);
        if (typeof updateData.listItems === 'string') updateData.listItems = JSON.parse(updateData.listItems);
        if (typeof updateData.cards === 'string') updateData.cards = JSON.parse(updateData.cards);

        if (req.files && updateData.cards) {
            for (let i = 0; i < updateData.cards.length; i++) {
                const fieldName = `icon${i}`;
                if (req.files[fieldName]) {
                    updateData.cards[i].iconSrc = `/uploads/organic_expo/${req.files[fieldName][0].filename}`;
                }
            }
        }
        
        const data = await GlobalPlatform.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Global Platform updated successfully' });
    } catch (error) {
        console.error('Update GlobalPlatform error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteGlobalPlatformById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await GlobalPlatform.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Global Platform deleted successfully' });
    } catch (error) {
        console.error('Delete GlobalPlatform error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
