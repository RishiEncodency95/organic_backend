import { Request, Response } from "express";
import SponsorshipCategories from "../../../../models/website/home/SponsorshipCategories.model";
const path = require('path');
const fs = require('fs');

export const createSponsorshipCategories = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.categories === 'string') updateData.categories = JSON.parse(updateData.categories);
        if (typeof updateData.promoBox === 'string') updateData.promoBox = JSON.parse(updateData.promoBox);
        if (typeof updateData.form === 'string') updateData.form = JSON.parse(updateData.form);

        if (req.files) {
            if (!updateData.promoBox) updateData.promoBox = {};
            
            if (req.files.image && req.files.image[0]) {
                updateData.promoBox.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
            }
            
            if (req.files.brochure && req.files.brochure[0]) {
                if (!updateData.promoBox.buttons) updateData.promoBox.buttons = {};
                updateData.promoBox.buttons.brochureLink = `/uploads/organic_expo/${req.files.brochure[0].filename}`;
            }
        }

        const data = await SponsorshipCategories.create(updateData);
        res.json({ success: true, data, message: 'Sponsorship Categories created successfully' });
    } catch (error) {
        console.error('Create SponsorshipCategories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllSponsorshipCategories = async (req: Request | any, res: Response | any) => {
    try {
        const data = await SponsorshipCategories.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All SponsorshipCategories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getSponsorshipCategoriesById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await SponsorshipCategories.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch SponsorshipCategories by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateSponsorshipCategoriesById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.categories === 'string') updateData.categories = JSON.parse(updateData.categories);
        if (typeof updateData.promoBox === 'string') updateData.promoBox = JSON.parse(updateData.promoBox);
        if (typeof updateData.form === 'string') updateData.form = JSON.parse(updateData.form);

        if (req.files) {
            if (!updateData.promoBox) updateData.promoBox = {};
            
            if (req.files.image && req.files.image[0]) {
                updateData.promoBox.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
            }
            
            if (req.files.brochure && req.files.brochure[0]) {
                if (!updateData.promoBox.buttons) updateData.promoBox.buttons = {};
                updateData.promoBox.buttons.brochureLink = `/uploads/organic_expo/${req.files.brochure[0].filename}`;
            }
        }

        const data = await SponsorshipCategories.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Sponsorship Categories updated successfully' });
    } catch (error) {
        console.error('Update SponsorshipCategories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteSponsorshipCategoriesById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await SponsorshipCategories.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Sponsorship Categories deleted successfully' });
    } catch (error) {
        console.error('Delete SponsorshipCategories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
