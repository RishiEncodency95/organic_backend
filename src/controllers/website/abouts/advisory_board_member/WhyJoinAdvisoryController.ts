import { Request, Response } from 'express';
import WhyJoinAdvisory from '../../../../models/website/abouts/advisory_board_member/WhyJoinAdvisory';

export const createWhyJoinAdvisory = async (req: Request, res: Response) => {
    try {
        const newData = new WhyJoinAdvisory(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getWhyJoinAdvisorys = async (req: Request, res: Response) => {
    try {
        const data = await WhyJoinAdvisory.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getWhyJoinAdvisoryById = async (req: Request, res: Response) => {
    try {
        const data = await WhyJoinAdvisory.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateWhyJoinAdvisory = async (req: Request, res: Response) => {
    try {
        const updatedData = await WhyJoinAdvisory.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteWhyJoinAdvisory = async (req: Request, res: Response) => {
    try {
        const deletedData = await WhyJoinAdvisory.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
