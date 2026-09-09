import { Request, Response } from 'express';
import BlogSlugBottomBanner from '../../../../models/website/abouts/blog_slug/BlogSlugBottomBanner';

export const createBlogSlugBottomBanner = async (req: Request, res: Response): Promise<void> => {
    try {
        const newData = new BlogSlugBottomBanner(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBlogSlugBottomBanners = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogSlugBottomBanner.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getBlogSlugBottomBannerById = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogSlugBottomBanner.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBlogSlugBottomBanner = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedData = await BlogSlugBottomBanner.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteBlogSlugBottomBanner = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedData = await BlogSlugBottomBanner.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
