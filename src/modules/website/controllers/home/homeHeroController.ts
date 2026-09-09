import { Request, Response } from "express";
import HomeHero from "../../../../models/website/home/HomeHero.model";


    export const getHomeHero = async (req: Request | any, res: Response | any) => {
        try {
            let data = await HomeHero.findOne();
            if (!data) data = await HomeHero.create({});
            res.json({ success: true, data });
        } catch (error) {
            console.error('Fetch HomeHero error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updateHomeHero = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            if (req.file) {
                updateData.img = `/uploads/organic_expo/${req.file.filename}`;
            }
            const data = await HomeHero.findOneAndUpdate({}, updateData, { new: true, upsert: true });
            res.json({ success: true, data, message: 'Home Hero updated successfully' });
        } catch (error) {
            console.error('Update HomeHero error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
