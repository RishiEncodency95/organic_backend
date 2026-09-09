import { Request, Response } from "express";
import BecomeSponsor from "../../../../models/website/home/BecomeSponsor.model";

export const createBecomeSponsor = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        if (typeof updateData.leftSection === 'string') updateData.leftSection = JSON.parse(updateData.leftSection);
        if (typeof updateData.centerSection === 'string') updateData.centerSection = JSON.parse(updateData.centerSection);
        if (typeof updateData.rightSection === 'string') updateData.rightSection = JSON.parse(updateData.rightSection);

        if (req.files && req.files.image && req.files.image[0]) {
            if (!updateData.centerSection) updateData.centerSection = {};
            updateData.centerSection.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
        }
        const data = await BecomeSponsor.create(updateData);
        res.json({ success: true, data, message: 'Become Sponsor created successfully' });
    } catch (error) {
        console.error('Create BecomeSponsor error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllBecomeSponsor = async (req: Request | any, res: Response | any) => {
    try {
        const data = await BecomeSponsor.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All BecomeSponsor error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getBecomeSponsorById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await BecomeSponsor.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch BecomeSponsor by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateBecomeSponsorById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        if (typeof updateData.leftSection === 'string') updateData.leftSection = JSON.parse(updateData.leftSection);
        if (typeof updateData.centerSection === 'string') updateData.centerSection = JSON.parse(updateData.centerSection);
        if (typeof updateData.rightSection === 'string') updateData.rightSection = JSON.parse(updateData.rightSection);

        if (req.files && req.files.image && req.files.image[0]) {
            if (!updateData.centerSection) updateData.centerSection = {};
            updateData.centerSection.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
        }

        const data = await BecomeSponsor.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Become Sponsor updated successfully' });
    } catch (error) {
        console.error('Update BecomeSponsor error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteBecomeSponsorById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await BecomeSponsor.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Become Sponsor deleted successfully' });
    } catch (error) {
        console.error('Delete BecomeSponsor error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
