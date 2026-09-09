import { Request, Response } from 'express';
import AdvisoryHero from '../../../../models/website/abouts/advisory_board_member/AdvisoryHero';

export const createAdvisoryHero = async (req: Request, res: Response) => {
    try {
        const newData = new AdvisoryHero(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getAdvisoryHeros = async (req: Request, res: Response) => {
    try {
        const data = await AdvisoryHero.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getAdvisoryHeroById = async (req: Request, res: Response) => {
    try {
        const data = await AdvisoryHero.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateAdvisoryHero = async (req: Request, res: Response) => {
    try {
        const updatedData = await AdvisoryHero.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteAdvisoryHero = async (req: Request, res: Response) => {
    try {
        const deletedData = await AdvisoryHero.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
