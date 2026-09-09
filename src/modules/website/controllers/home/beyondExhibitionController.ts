import { Request, Response } from "express";
import BeyondExhibition from "../../../../models/website/home/BeyondExhibition.model";
const path = require('path');
const fs = require('fs');


    export const getBeyondExhibition = async (req: Request | any, res: Response | any) => {
        try {
            let data = await BeyondExhibition.findOne();
            if (!data) {
                data = await BeyondExhibition.create({});
            }
            res.json({ success: true, data });
        } catch (error) {
            console.error('Fetch BeyondExhibition error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updateBeyondExhibition = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            
            // Parse nested JSON strings if they come from formData
            if (typeof updateData.extras === 'string') {
                updateData.extras = JSON.parse(updateData.extras);
            }

            // Handle file upload for image
            if (req.files && req.files.image && req.files.image[0]) {
                updateData.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
            }

            const data = await BeyondExhibition.findOneAndUpdate({}, updateData, { new: true, upsert: true });
            res.json({ success: true, data, message: 'Beyond Exhibition updated successfully' });
        } catch (error) {
            console.error('Update BeyondExhibition error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
