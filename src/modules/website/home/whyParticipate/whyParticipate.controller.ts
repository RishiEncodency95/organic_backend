import { Request, Response } from "express";
import WhyParticipate from './whyParticipate.model';
const path = require('path');
const fs = require('fs');


    export const getWhyParticipate = async (req: Request | any, res: Response | any) => {
        try {
            let data = await WhyParticipate.findOne();
            if (!data) {
                data = await WhyParticipate.create({});
            }
            res.json({ success: true, data });
        } catch (error) {
            console.error('Fetch WhyParticipate error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updateWhyParticipate = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            
            // Parse nested JSON strings if they come from formData
            if (typeof updateData.points === 'string') {
                updateData.points = JSON.parse(updateData.points);
            }
            if (typeof updateData.mainPoints === 'string') {
                updateData.mainPoints = JSON.parse(updateData.mainPoints);
            }
            if (typeof updateData.buttons === 'string') {
                updateData.buttons = JSON.parse(updateData.buttons);
            }

            // Handle file upload for image
            if (req.files && req.files.image && req.files.image[0]) {
                updateData.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
            }
            
            // Handle file upload for brochure (if any)
            if (req.files && req.files.brochure && req.files.brochure[0]) {
                if (!updateData.buttons) {
                    updateData.buttons = {};
                }
                if (!updateData.buttons.brochure) {
                    updateData.buttons.brochure = {};
                }
                updateData.buttons.brochure.link = `/uploads/organic_expo/${req.files.brochure[0].filename}`;
            }

            const data = await WhyParticipate.findOneAndUpdate({}, updateData, { new: true, upsert: true });
            res.json({ success: true, data, message: 'Why Participate updated successfully' });
        } catch (error) {
            console.error('Update WhyParticipate error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }


