import { Request, Response } from 'express';
import BlogSidebar from '../../../../models/website/abouts/blog/BlogSidebar';

export const createBlogSidebar = async (req: Request, res: Response): Promise<void> => {
    try {
        const newData = new BlogSidebar(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBlogSidebars = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogSidebar.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getBlogSidebarById = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogSidebar.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBlogSidebar = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedData = await BlogSidebar.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteBlogSidebar = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedData = await BlogSidebar.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
