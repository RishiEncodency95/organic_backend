import { Request, Response } from "express";
import TestimonialsCarousel from './testimonialsCarousel.model';

export const createTestimonials = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.testimonials === 'string') {
            updateData.testimonials = JSON.parse(updateData.testimonials);
        }

        const data = await TestimonialsCarousel.create(updateData);
        res.json({ success: true, data, message: 'Testimonials created successfully' });
    } catch (error) {
        console.error('Create TestimonialsCarousel error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllTestimonials = async (req: Request | any, res: Response | any) => {
    try {
        const data = await TestimonialsCarousel.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All TestimonialsCarousel error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getTestimonialsById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await TestimonialsCarousel.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch TestimonialsCarousel by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateTestimonialsById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.testimonials === 'string') {
            updateData.testimonials = JSON.parse(updateData.testimonials);
        }

        const data = await TestimonialsCarousel.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Testimonials updated successfully' });
    } catch (error) {
        console.error('Update TestimonialsCarousel error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteTestimonialsById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await TestimonialsCarousel.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Testimonials deleted successfully' });
    } catch (error) {
        console.error('Delete TestimonialsCarousel error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
