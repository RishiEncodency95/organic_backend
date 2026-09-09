import { Request, Response } from 'express';
import ChairmanMessage from '../../../../models/website/abouts/advisory_board_member/ChairmanMessage';

export const createChairmanMessage = async (req: Request, res: Response) => {
    try {
        const newData = new ChairmanMessage(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getChairmanMessages = async (req: Request, res: Response) => {
    try {
        const data = await ChairmanMessage.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getChairmanMessageById = async (req: Request, res: Response) => {
    try {
        const data = await ChairmanMessage.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateChairmanMessage = async (req: Request, res: Response) => {
    try {
        const updatedData = await ChairmanMessage.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteChairmanMessage = async (req: Request, res: Response) => {
    try {
        const deletedData = await ChairmanMessage.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
