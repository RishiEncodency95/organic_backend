import { Request, Response } from "express";
import BuyerSellerMeet from './buyerSellerMeet.model';
const path = require('path');
const fs = require('fs');

export const createBuyerSellerMeet = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.leftSection === 'string') updateData.leftSection = JSON.parse(updateData.leftSection);
        if (typeof updateData.rightSection === 'string') updateData.rightSection = JSON.parse(updateData.rightSection);
        if (typeof updateData.statsBar === 'string') updateData.statsBar = JSON.parse(updateData.statsBar);
        if (typeof updateData.premiumBand === 'string') updateData.premiumBand = JSON.parse(updateData.premiumBand);

        if (req.files && req.files.image && req.files.image[0]) {
            if (!updateData.rightSection) updateData.rightSection = {};
            updateData.rightSection.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
        }

        const data = await BuyerSellerMeet.create(updateData);
        res.json({ success: true, data, message: 'Buyer Seller Meet created successfully' });
    } catch (error) {
        console.error('Create BuyerSellerMeet error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllBuyerSellerMeet = async (req: Request | any, res: Response | any) => {
    try {
        const data = await BuyerSellerMeet.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All BuyerSellerMeet error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getBuyerSellerMeetById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await BuyerSellerMeet.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch BuyerSellerMeet by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateBuyerSellerMeetById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.leftSection === 'string') updateData.leftSection = JSON.parse(updateData.leftSection);
        if (typeof updateData.rightSection === 'string') updateData.rightSection = JSON.parse(updateData.rightSection);
        if (typeof updateData.statsBar === 'string') updateData.statsBar = JSON.parse(updateData.statsBar);
        if (typeof updateData.premiumBand === 'string') updateData.premiumBand = JSON.parse(updateData.premiumBand);

        if (req.files && req.files.image && req.files.image[0]) {
            if (!updateData.rightSection) updateData.rightSection = {};
            updateData.rightSection.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
        }

        const data = await BuyerSellerMeet.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Buyer Seller Meet updated successfully' });
    } catch (error) {
        console.error('Update BuyerSellerMeet error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteBuyerSellerMeetById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await BuyerSellerMeet.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Buyer Seller Meet deleted successfully' });
    } catch (error) {
        console.error('Delete BuyerSellerMeet error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
