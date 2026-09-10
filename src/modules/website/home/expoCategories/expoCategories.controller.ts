import { Request, Response } from "express";
import ExpoCategories from './expoCategories.model';
const path = require('path');
const fs = require('fs');

export const createExpoCategories = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.categories === 'string') {
            updateData.categories = JSON.parse(updateData.categories);
        }

        if (req.files && updateData.categories) {
            for (let i = 0; i < updateData.categories.length; i++) {
                const fieldName = `categoryImage${i}`;
                if (req.files[fieldName] && req.files[fieldName][0]) {
                    updateData.categories[i].image = `/uploads/organic_expo/${req.files[fieldName][0].filename}`;
                }
            }
        }

        const data = await ExpoCategories.create(updateData);
        res.json({ success: true, data, message: 'Expo Categories created successfully' });
    } catch (error) {
        console.error('Create ExpoCategories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllExpoCategories = async (req: Request | any, res: Response | any) => {
    try {
        const data = await ExpoCategories.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All ExpoCategories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getExpoCategoriesById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await ExpoCategories.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch ExpoCategories by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateExpoCategoriesById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.categories === 'string') {
            updateData.categories = JSON.parse(updateData.categories);
        }

        if (req.files && updateData.categories) {
            for (let i = 0; i < updateData.categories.length; i++) {
                const fieldName = `categoryImage${i}`;
                if (req.files[fieldName] && req.files[fieldName][0]) {
                    updateData.categories[i].image = `/uploads/organic_expo/${req.files[fieldName][0].filename}`;
                }
            }
        }

        const data = await ExpoCategories.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Expo Categories updated successfully' });
    } catch (error) {
        console.error('Update ExpoCategories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteExpoCategoriesById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await ExpoCategories.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Expo Categories deleted successfully' });
    } catch (error) {
        console.error('Delete ExpoCategories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
