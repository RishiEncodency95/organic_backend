import { Request, Response } from "express";
import ConferenceSeminars from "../../../../models/website/home/ConferenceSeminars.model";
const path = require('path');
const fs = require('fs');


    export const getConferenceSeminars = async (req: Request | any, res: Response | any) => {
        try {
            let data = await ConferenceSeminars.findOne();
            if (!data) {
                data = await ConferenceSeminars.create({});
            }
            res.json({ success: true, data });
        } catch (error) {
            console.error('Fetch ConferenceSeminars error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updateConferenceSeminars = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            
            // Parse nested JSON strings if they come from formData
            if (typeof updateData.checklist === 'string') {
                updateData.checklist = JSON.parse(updateData.checklist);
            }
            if (typeof updateData.button === 'string') {
                updateData.button = JSON.parse(updateData.button);
            }
            if (typeof updateData.eventInfo === 'string') {
                updateData.eventInfo = JSON.parse(updateData.eventInfo);
            }

            // Handle file upload for image
            if (req.files && req.files.image && req.files.image[0]) {
                updateData.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
            }

            const data = await ConferenceSeminars.findOneAndUpdate({}, updateData, { new: true, upsert: true });
            res.json({ success: true, data, message: 'Conference Seminars updated successfully' });
        } catch (error) {
            console.error('Update ConferenceSeminars error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
