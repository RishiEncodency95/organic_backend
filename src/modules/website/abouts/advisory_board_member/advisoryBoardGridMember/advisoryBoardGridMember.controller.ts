import { Request, Response } from 'express';
import AdvisoryBoardGridMember from './advisoryBoardGridMember.model';

export const createAdvisoryBoardGridMember = async (req: Request, res: Response) => {
    try {
        const newData = new AdvisoryBoardGridMember(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getAdvisoryBoardGridMembers = async (req: Request, res: Response) => {
    try {
        const data = await AdvisoryBoardGridMember.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getAdvisoryBoardGridMemberById = async (req: Request, res: Response) => {
    try {
        const data = await AdvisoryBoardGridMember.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateAdvisoryBoardGridMember = async (req: Request, res: Response) => {
    try {
        const updatedData = await AdvisoryBoardGridMember.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteAdvisoryBoardGridMember = async (req: Request, res: Response) => {
    try {
        const deletedData = await AdvisoryBoardGridMember.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
