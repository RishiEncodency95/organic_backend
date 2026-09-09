import { Request, Response } from "express";
import SponsorshipCategories from './sponsorshipCategories.model';
const path = require('path');
const fs = require('fs');


    export const getSponsorshipCategories = async (req: Request | any, res: Response | any) => {
        try {
            let data = await SponsorshipCategories.findOne();
            if (!data) {
                data = await SponsorshipCategories.create({});
            }
            res.json({ success: true, data });
        } catch (error) {
            console.error('Fetch SponsorshipCategories error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updateSponsorshipCategories = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            
            // Parse nested JSON strings if they come from formData or JSON stringified body
            if (typeof updateData.categories === 'string') {
                updateData.categories = JSON.parse(updateData.categories);
            }
            if (typeof updateData.promoBox === 'string') {
                updateData.promoBox = JSON.parse(updateData.promoBox);
            }
            if (typeof updateData.form === 'string') {
                updateData.form = JSON.parse(updateData.form);
            }

            // Handle file upload for image and brochureLink in promoBox
            if (req.files) {
                if (!updateData.promoBox) {
                    updateData.promoBox = {};
                }
                
                if (req.files.image && req.files.image[0]) {
                    updateData.promoBox.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
                }
                
                if (req.files.brochure && req.files.brochure[0]) {
                    if (!updateData.promoBox.buttons) {
                        updateData.promoBox.buttons = {};
                    }
                    updateData.promoBox.buttons.brochureLink = `/uploads/organic_expo/${req.files.brochure[0].filename}`;
                }
            }

            const data = await SponsorshipCategories.findOneAndUpdate({}, updateData, { new: true, upsert: true });
            res.json({ success: true, data, message: 'Sponsorship Categories updated successfully' });
        } catch (error) {
            console.error('Update SponsorshipCategories error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }


