import { Request, Response } from "express";
import GlobalPlatform from "../../../../models/website/home/GlobalPlatform.model";
const path = require('path');
const fs = require('fs');


    export const getGlobalPlatform = async (req: Request | any, res: Response | any) => {
        try {
            let data = await GlobalPlatform.findOne();
            if (!data) {
                data = await GlobalPlatform.create({
                    listItems: [
                        "International Exhibitors & Global Brands",
                        "Buyers, Distributors & Importers",
                        "Research & Innovation | Startups",
                        "Investors, Financial Institutions",
                        "Government Bodies, Embassies & Policy Makers"
                    ],
                    cards: [
                        { iconSrc: "", iconAlt: "Global Connections", iconWidth: 90, iconHeight: 90, title: "GLOBAL\nCONNECTIONS", desc: "Connect with global leaders in organic trade and sustainable business. Expand your network across international markets to build long-term, profitable relationships.", bgClass: "bg-gradient-to-b from-white to-blue-50/80", borderClass: "border-blue-200" },
                        { iconSrc: "", iconAlt: "International Alliances", iconWidth: 120, iconHeight: 120, title: "INTERNATIONAL\nALLIANCES", desc: "Forge strategic alliances with prominent international organizations, trade bodies, and embassies to unlock massive cross-border trade opportunities.", bgClass: "bg-gradient-to-b from-white to-orange-50/80", borderClass: "border-orange-200" },
                        { iconSrc: "", iconAlt: "Policy & Knowledge", iconWidth: 120, iconHeight: 120, title: "POLICY &\nKNOWLEDGE", desc: "Engage directly with global policy makers, researchers, and leaders driving regulatory changes and sustainability standards in the organic ecosystem.", bgClass: "bg-gradient-to-b from-white to-green-50/80", borderClass: "border-green-200" },
                        { iconSrc: "", iconAlt: "Investment & Innovation", iconWidth: 130, iconHeight: 130, title: "INVESTMENT &\nINNOVATION", desc: "Discover high-growth investment opportunities and explore cutting-edge, innovative solutions presented by dynamic startups in the wellness industry.", bgClass: "bg-gradient-to-b from-white to-purple-50/80", borderClass: "border-purple-200" }
                    ]
                });
            }
            res.json({ success: true, data });
        } catch (error) {
            console.error('Fetch GlobalPlatform error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updateGlobalPlatform = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            
            // Parse nested JSON strings if they come from formData
            if (typeof updateData.title === 'string') {
                updateData.title = JSON.parse(updateData.title);
            }
            if (typeof updateData.listItems === 'string') {
                updateData.listItems = JSON.parse(updateData.listItems);
            }
            if (typeof updateData.cards === 'string') {
                updateData.cards = JSON.parse(updateData.cards);
            }

            // Handle multiple file uploads for card icons
            // Expected file field names: icon0, icon1, icon2, icon3
            if (req.files && updateData.cards) {
                for (let i = 0; i < updateData.cards.length; i++) {
                    const fieldName = `icon${i}`;
                    if (req.files[fieldName]) {
                        updateData.cards[i].iconSrc = `/uploads/organic_expo/${req.files[fieldName][0].filename}`;
                    }
                }
            }
            
            const data = await GlobalPlatform.findOneAndUpdate({}, updateData, { new: true, upsert: true });
            res.json({ success: true, data, message: 'Global Platform updated successfully' });
        } catch (error) {
            console.error('Update GlobalPlatform error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
