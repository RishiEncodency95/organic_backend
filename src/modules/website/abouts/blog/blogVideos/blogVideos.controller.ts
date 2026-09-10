import { Request, Response } from 'express';
import BlogVideos from './blogVideos.model';

export const createBlogVideos = async (req: Request, res: Response): Promise<void> => {
    try {
        const newData = new BlogVideos(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBlogVideoss = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogVideos.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getBlogVideosById = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogVideos.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBlogVideos = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedData = await BlogVideos.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteBlogVideos = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedData = await BlogVideos.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
