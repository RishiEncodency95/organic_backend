import { Request, Response } from "express";
import AboutFaq from "../../../../../models/website/abouts/about/AboutFaq.model";

export const createAboutFaq = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await AboutFaq.create(updateData);
        res.json({ success: true, data, message: 'AboutFaq created successfully' });
    } catch (error) {
        console.error('Create AboutFaq error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllAboutFaq = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutFaq.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All AboutFaq error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAboutFaqById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutFaq.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch AboutFaq by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateAboutFaqById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        const data = await AboutFaq.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'AboutFaq updated successfully' });
    } catch (error) {
        console.error('Update AboutFaq error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteAboutFaqById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await AboutFaq.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'AboutFaq deleted successfully' });
    } catch (error) {
        console.error('Delete AboutFaq error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
