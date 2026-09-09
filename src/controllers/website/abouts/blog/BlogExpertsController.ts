import { Request, Response } from 'express';
import BlogExperts from '../../../../models/website/abouts/blog/BlogExperts';

export const createBlogExperts = async (req: Request, res: Response): Promise<void> => {
    try {
        const newData = new BlogExperts(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBlogExpertss = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogExperts.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getBlogExpertsById = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogExperts.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBlogExperts = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedData = await BlogExperts.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteBlogExperts = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedData = await BlogExperts.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
