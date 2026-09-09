import { Request, Response } from "express";
import ExpoCategories from "../../../../models/website/home/ExpoCategories.model";
const path = require('path');
const fs = require('fs');


    export const getExpoCategories = async (req: Request | any, res: Response | any) => {
        try {
            let data = await ExpoCategories.findOne();
            if (!data) {
                data = await ExpoCategories.create({});
            }
            res.json({ success: true, data });
        } catch (error) {
            console.error('Fetch ExpoCategories error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updateExpoCategories = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            
            // Parse nested JSON strings if they come from formData
            if (typeof updateData.categories === 'string') {
                updateData.categories = JSON.parse(updateData.categories);
            }

            // Handle file upload for images inside the categories array
            if (req.files && updateData.categories) {
                for (let i = 0; i < updateData.categories.length; i++) {
                    const fieldName = `categoryImage${i}`;
                    if (req.files[fieldName] && req.files[fieldName][0]) {
                        updateData.categories[i].image = `/uploads/organic_expo/${req.files[fieldName][0].filename}`;
                    }
                }
            }

            const data = await ExpoCategories.findOneAndUpdate({}, updateData, { new: true, upsert: true });
            res.json({ success: true, data, message: 'Expo Categories updated successfully' });
        } catch (error) {
            console.error('Update ExpoCategories error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
