import { Request, Response } from "express";
import BuyerSellerMeet from './buyerSellerMeet.model';
const path = require('path');
const fs = require('fs');


    export const getBuyerSellerMeet = async (req: Request | any, res: Response | any) => {
        try {
            let data = await BuyerSellerMeet.findOne();
            if (!data) {
                data = await BuyerSellerMeet.create({});
            }
            res.json({ success: true, data });
        } catch (error) {
            console.error('Fetch BuyerSellerMeet error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updateBuyerSellerMeet = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            
            // Parse nested JSON strings if they come from formData or JSON stringified body
            if (typeof updateData.leftSection === 'string') {
                updateData.leftSection = JSON.parse(updateData.leftSection);
            }
            if (typeof updateData.rightSection === 'string') {
                updateData.rightSection = JSON.parse(updateData.rightSection);
            }
            if (typeof updateData.statsBar === 'string') {
                updateData.statsBar = JSON.parse(updateData.statsBar);
            }
            if (typeof updateData.premiumBand === 'string') {
                updateData.premiumBand = JSON.parse(updateData.premiumBand);
            }

            // Handle file upload for rightSection image
            if (req.files && req.files.image && req.files.image[0]) {
                if (!updateData.rightSection) {
                    updateData.rightSection = {};
                }
                updateData.rightSection.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
            }

            const data = await BuyerSellerMeet.findOneAndUpdate({}, updateData, { new: true, upsert: true });
            res.json({ success: true, data, message: 'Buyer Seller Meet updated successfully' });
        } catch (error) {
            console.error('Update BuyerSellerMeet error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }


