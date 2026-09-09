import { Request, Response } from 'express';
import BlogFeatured from '../../../../models/website/abouts/blog/BlogFeatured';

export const createBlogFeatured = async (req: Request, res: Response): Promise<void> => {
    try {
        const newData = new BlogFeatured(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBlogFeatureds = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogFeatured.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getBlogFeaturedById = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogFeatured.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBlogFeatured = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedData = await BlogFeatured.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteBlogFeatured = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedData = await BlogFeatured.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
