import { Request, Response } from 'express';
import AdvisoryBoardGrid from './advisoryBoardGrid.model';

export const createAdvisoryBoardGrid = async (req: Request, res: Response) => {
    try {
        const newData = new AdvisoryBoardGrid(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getAdvisoryBoardGrids = async (req: Request, res: Response) => {
    try {
        const data = await AdvisoryBoardGrid.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getAdvisoryBoardGridById = async (req: Request, res: Response) => {
    try {
        const data = await AdvisoryBoardGrid.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateAdvisoryBoardGrid = async (req: Request, res: Response) => {
    try {
        const updatedData = await AdvisoryBoardGrid.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteAdvisoryBoardGrid = async (req: Request, res: Response) => {
    try {
        const deletedData = await AdvisoryBoardGrid.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
