import { Request, Response } from 'express';
import BlogCta from '../../../../models/website/abouts/blog/BlogCta';

export const createBlogCta = async (req: Request, res: Response): Promise<void> => {
    try {
        const newData = new BlogCta(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBlogCtas = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogCta.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getBlogCtaById = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogCta.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBlogCta = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedData = await BlogCta.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteBlogCta = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedData = await BlogCta.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
