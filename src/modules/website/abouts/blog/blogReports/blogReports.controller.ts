import { Request, Response } from 'express';
import BlogReports from './blogReports.model';

export const createBlogReports = async (req: Request, res: Response): Promise<void> => {
    try {
        const newData = new BlogReports(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBlogReportss = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogReports.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getBlogReportsById = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogReports.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBlogReports = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedData = await BlogReports.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteBlogReports = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedData = await BlogReports.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
