import { Request, Response } from "express";
import PartnersAndBrands from "../../../../models/website/home/PartnersAndBrands.model";
const path = require('path');
const fs = require('fs');


    export const getPartnersAndBrands = async (req: Request | any, res: Response | any) => {
        try {
            let data = await PartnersAndBrands.findOne();
            if (!data) {
                data = await PartnersAndBrands.create({});
            }
            res.json({ success: true, data });
        } catch (error) {
            console.error('Fetch PartnersAndBrands error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updatePartnersAndBrands = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            
            const arraysToParse = [
                'industryLeadersLogos',
                'knowledgeLogos',
                'wellnessLogos',
                'supportingLogos',
                'emergingBrandsLogos'
            ];

            // Parse nested JSON strings
            arraysToParse.forEach(arrName => {
                if (typeof updateData[arrName] === 'string') {
                    updateData[arrName] = JSON.parse(updateData[arrName]);
                }
            });

            // Handle file uploads by scanning req.files
            if (req.files && Array.isArray(req.files)) {
                req.files.forEach(file => {
                    // Expecting fieldnames like 'industryLeadersLogos_0', 'knowledgeLogos_2', etc.
                    const match = file.fieldname.match(/^([a-zA-Z]+)_(\d+)$/);
                    if (match) {
                        const arrName = match[1];
                        const index = parseInt(match[2], 10);

                        if (updateData[arrName] && updateData[arrName][index]) {
                            updateData[arrName][index].image = `/uploads/organic_expo/${file.filename}`;
                        }
                    }
                });
            }

            const data = await PartnersAndBrands.findOneAndUpdate({}, updateData, { new: true, upsert: true });
            res.json({ success: true, data, message: 'Partners and Brands updated successfully' });
        } catch (error) {
            console.error('Update PartnersAndBrands error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
