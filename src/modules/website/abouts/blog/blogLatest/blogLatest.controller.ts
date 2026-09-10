import { Request, Response } from 'express';
import BlogLatest from './blogLatest.model';

export const createBlogLatest = async (req: Request, res: Response): Promise<void> => {
    try {
        const newData = new BlogLatest(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBlogLatests = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogLatest.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getBlogLatestById = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogLatest.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBlogLatest = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedData = await BlogLatest.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteBlogLatest = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedData = await BlogLatest.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
