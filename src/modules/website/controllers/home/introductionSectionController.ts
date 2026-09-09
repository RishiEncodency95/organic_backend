import { Request, Response } from "express";
import IntroductionSection from "../../../../models/website/home/IntroductionSection.model";


    export const getIntroduction = async (req: Request | any, res: Response | any) => {
        try {
            let data = await IntroductionSection.findOne();
            if (!data) {
                data = await IntroductionSection.create({
                    paragraphs: [
                        { id: 1, highlightStart: "Bharat Organic Expo 2027", text: " is India's leading international exhibition dedicated to organic products, sustainable agriculture, natural wellness, eco-friendly innovations, and green business opportunities. The Expo brings together manufacturers, exhibitors, buyers, importers, exporters, investors, government organizations, industry experts, startups, researchers, and global delegates under one dynamic platform.", hasBorder: true },
                        { id: 2, highlightStart: "", text: "Designed to foster business growth, knowledge sharing, innovation, and international collaboration, Bharat Organic Expo serves as the perfect destination for discovering new products, building strategic partnerships, expanding global markets, and promoting a sustainable future.", hasBorder: false }
                    ]
                });
            }
            res.json({ success: true, data });
        } catch (error) {
            console.error('Fetch Introduction error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updateIntroduction = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            
            // Parse nested JSON strings if they come from formData
            if (typeof updateData.title === 'string') {
                updateData.title = JSON.parse(updateData.title);
            }
            if (typeof updateData.paragraphs === 'string') {
                updateData.paragraphs = JSON.parse(updateData.paragraphs);
            }
            if (typeof updateData.button === 'string') {
                updateData.button = JSON.parse(updateData.button);
            }

            if (req.file) {
                updateData.image = `/uploads/organic_expo/${req.file.filename}`;
            }
            
            const data = await IntroductionSection.findOneAndUpdate({}, updateData, { new: true, upsert: true });
            res.json({ success: true, data, message: 'Introduction section updated successfully' });
        } catch (error) {
            console.error('Update Introduction error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
