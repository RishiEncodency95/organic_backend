import { Request, Response } from 'express';
import AdvisoryPartner from './advisoryPartner.model';

export const createAdvisoryPartner = async (req: Request, res: Response) => {
    try {
        const newData = new AdvisoryPartner(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getAdvisoryPartners = async (req: Request, res: Response) => {
    try {
        const data = await AdvisoryPartner.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getAdvisoryPartnerById = async (req: Request, res: Response) => {
    try {
        const data = await AdvisoryPartner.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateAdvisoryPartner = async (req: Request, res: Response) => {
    try {
        const updatedData = await AdvisoryPartner.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteAdvisoryPartner = async (req: Request, res: Response) => {
    try {
        const deletedData = await AdvisoryPartner.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
