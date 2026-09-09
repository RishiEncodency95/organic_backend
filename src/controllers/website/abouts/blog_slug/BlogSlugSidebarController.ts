import { Request, Response } from 'express';
import BlogSlugSidebar from '../../../../models/website/abouts/blog_slug/BlogSlugSidebar';

export const createBlogSlugSidebar = async (req: Request, res: Response): Promise<void> => {
    try {
        const newData = new BlogSlugSidebar(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBlogSlugSidebars = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogSlugSidebar.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getBlogSlugSidebarById = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogSlugSidebar.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBlogSlugSidebar = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedData = await BlogSlugSidebar.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteBlogSlugSidebar = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedData = await BlogSlugSidebar.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
