import { Request, Response } from 'express';
import BlogHero from './blogHero.model';

export const createBlogHero = async (req: Request, res: Response): Promise<void> => {
    try {
        const newData = new BlogHero(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBlogHeros = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogHero.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getBlogHeroById = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogHero.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBlogHero = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedData = await BlogHero.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteBlogHero = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedData = await BlogHero.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
