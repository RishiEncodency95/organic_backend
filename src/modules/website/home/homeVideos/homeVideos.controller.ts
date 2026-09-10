import { Request, Response } from "express";
import HomeVideos from './homeVideos.model';
const path = require('path');
const fs = require('fs');

export const createVideos = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.videos === 'string') {
            updateData.videos = JSON.parse(updateData.videos);
        }

        if (req.files && Array.isArray(req.files)) {
            req.files.forEach((file: any) => {
                const match = file.fieldname.match(/^thumbnail_(\d+)$/);
                if (match) {
                    const index = parseInt(match[1], 10);
                    if (updateData.videos && updateData.videos[index]) {
                        updateData.videos[index].thumbnail = `/uploads/organic_expo/${file.filename}`;
                    }
                }
            });
        }

        const data = await HomeVideos.create(updateData);
        res.json({ success: true, data, message: 'Home Videos created successfully' });
    } catch (error) {
        console.error('Create HomeVideos error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllVideos = async (req: Request | any, res: Response | any) => {
    try {
        const data = await HomeVideos.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All HomeVideos error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getVideosById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await HomeVideos.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch HomeVideos by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updateVideosById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        if (typeof updateData.videos === 'string') {
            updateData.videos = JSON.parse(updateData.videos);
        }

        if (req.files && Array.isArray(req.files)) {
            req.files.forEach((file: any) => {
                const match = file.fieldname.match(/^thumbnail_(\d+)$/);
                if (match) {
                    const index = parseInt(match[1], 10);
                    if (updateData.videos && updateData.videos[index]) {
                        updateData.videos[index].thumbnail = `/uploads/organic_expo/${file.filename}`;
                    }
                }
            });
        }

        const data = await HomeVideos.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Home Videos updated successfully' });
    } catch (error) {
        console.error('Update HomeVideos error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteVideosById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await HomeVideos.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Home Videos deleted successfully' });
    } catch (error) {
        console.error('Delete HomeVideos error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
