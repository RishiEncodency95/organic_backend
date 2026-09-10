import { Request, Response } from 'express';
import BlogSlugArticle from './blogSlugArticle.model';

export const createBlogSlugArticle = async (req: Request, res: Response): Promise<void> => {
    try {
        const newData = new BlogSlugArticle(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBlogSlugArticles = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogSlugArticle.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getBlogSlugArticleById = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await BlogSlugArticle.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBlogSlugArticle = async (req: Request, res: Response): Promise<void> => {
    try {
        const updatedData = await BlogSlugArticle.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteBlogSlugArticle = async (req: Request, res: Response): Promise<void> => {
    try {
        const deletedData = await BlogSlugArticle.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
