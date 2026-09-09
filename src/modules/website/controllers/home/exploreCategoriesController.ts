import { Request, Response } from "express";
import ExploreCategories from "../../../../models/website/home/ExploreCategories.model";


    export const getAllCategories = async (req: Request | any, res: Response | any) => {
        try {
            const categories = await ExploreCategories.find().sort({ createdAt: -1 });
            res.json({ success: true, data: categories });
        } catch (error) {
            console.error('Fetch ExploreCategories error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const getCategoryById = async (req: Request | any, res: Response | any) => {
        try {
            const category = await ExploreCategories.findById(req.params.id);
            if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
            res.json({ success: true, data: category });
        } catch (error) {
            console.error('Fetch ExploreCategory by ID error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const createCategory = async (req: Request | any, res: Response | any) => {
        try {
            let data = { ...req.body };
            if (req.file) {
                data.logo = `/uploads/organic_expo/${req.file.filename}`;
            }
            if (req.user && req.user._id) {
                data.createdby = req.user._id;
            }
            const category = await ExploreCategories.create(data);
            res.status(201).json({ success: true, data: category, message: 'Category created successfully' });
        } catch (error) {
            console.error('Create ExploreCategory error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updateCategory = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            if (req.file) {
                updateData.logo = `/uploads/organic_expo/${req.file.filename}`;
            }
            if (req.user && req.user._id) {
                updateData.updatedby = req.user._id;
            }
            const category = await ExploreCategories.findByIdAndUpdate(req.params.id, updateData, { new: true });
            if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
            res.json({ success: true, data: category, message: 'Category updated successfully' });
        } catch (error) {
            console.error('Update ExploreCategory error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const deleteCategory = async (req: Request | any, res: Response | any) => {
        try {
            const category = await ExploreCategories.findByIdAndDelete(req.params.id);
            if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
            res.json({ success: true, message: 'Category deleted successfully' });
        } catch (error) {
            console.error('Delete ExploreCategory error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
