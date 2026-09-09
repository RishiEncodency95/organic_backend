import { Request, Response } from "express";
import IntroductionSection from "../../../../models/website/home/IntroductionSection.model";

export const createIntroduction = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.title === 'string') updateData.title = JSON.parse(updateData.title);
        if (typeof updateData.paragraphs === 'string') updateData.paragraphs = JSON.parse(updateData.paragraphs);
        if (typeof updateData.button === 'string') updateData.button = JSON.parse(updateData.button);

        if (req.file) {
            updateData.image = `/uploads/organic_expo/${req.file.filename}`;
        }
        
        const data = await IntroductionSection.create(updateData);
        res.json({ success: true, data, message: 'Introduction section created successfully' });
    } catch (error) {
        console.error('Create Introduction error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllIntroduction = async (req: Request | any, res: Response | any) => {
    try {
        const data = await IntroductionSection.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All Introduction error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getIntroductionById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await IntroductionSection.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch Introduction by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateIntroductionById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.title === 'string') updateData.title = JSON.parse(updateData.title);
        if (typeof updateData.paragraphs === 'string') updateData.paragraphs = JSON.parse(updateData.paragraphs);
        if (typeof updateData.button === 'string') updateData.button = JSON.parse(updateData.button);

        if (req.file) {
            updateData.image = `/uploads/organic_expo/${req.file.filename}`;
        }
        
        const data = await IntroductionSection.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Introduction section updated successfully' });
    } catch (error) {
        console.error('Update Introduction error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteIntroductionById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await IntroductionSection.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Introduction section deleted successfully' });
    } catch (error) {
        console.error('Delete Introduction error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
