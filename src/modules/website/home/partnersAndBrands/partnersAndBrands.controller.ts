import { Request, Response } from "express";
import PartnersAndBrands from './partnersAndBrands.model';
const path = require('path');
const fs = require('fs');

export const createPartnersAndBrands = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        const arraysToParse = [
            'industryLeadersLogos',
            'knowledgeLogos',
            'wellnessLogos',
            'supportingLogos',
            'emergingBrandsLogos'
        ];

        arraysToParse.forEach(arrName => {
            if (typeof updateData[arrName] === 'string') {
                updateData[arrName] = JSON.parse(updateData[arrName]);
            }
        });

        if (req.files && Array.isArray(req.files)) {
            req.files.forEach((file: any) => {
                const match = file.fieldname.match(/^([a-zA-Z]+)_(\d+)$/);
                if (match) {
                    const arrName = match[1];
                    const index = parseInt(match[2], 10);

                    if (updateData[arrName] && updateData[arrName][index]) {
                        updateData[arrName][index].image = `/uploads/organic_expo/${file.filename}`;
                    }
                }
            });
        }

        const data = await PartnersAndBrands.create(updateData);
        res.json({ success: true, data, message: 'Partners and Brands created successfully' });
    } catch (error) {
        console.error('Create PartnersAndBrands error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getAllPartnersAndBrands = async (req: Request | any, res: Response | any) => {
    try {
        const data = await PartnersAndBrands.find();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch All PartnersAndBrands error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const getPartnersAndBrandsById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await PartnersAndBrands.findById(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch PartnersAndBrands by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const updatePartnersAndBrandsById = async (req: Request | any, res: Response | any) => {
    try {
        let updateData = { ...req.body };
        
        const arraysToParse = [
            'industryLeadersLogos',
            'knowledgeLogos',
            'wellnessLogos',
            'supportingLogos',
            'emergingBrandsLogos'
        ];

        arraysToParse.forEach(arrName => {
            if (typeof updateData[arrName] === 'string') {
                updateData[arrName] = JSON.parse(updateData[arrName]);
            }
        });

        if (req.files && Array.isArray(req.files)) {
            req.files.forEach((file: any) => {
                const match = file.fieldname.match(/^([a-zA-Z]+)_(\d+)$/);
                if (match) {
                    const arrName = match[1];
                    const index = parseInt(match[2], 10);

                    if (updateData[arrName] && updateData[arrName][index]) {
                        updateData[arrName][index].image = `/uploads/organic_expo/${file.filename}`;
                    }
                }
            });
        }

        const data = await PartnersAndBrands.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data, message: 'Partners and Brands updated successfully' });
    } catch (error) {
        console.error('Update PartnersAndBrands error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deletePartnersAndBrandsById = async (req: Request | any, res: Response | any) => {
    try {
        const data = await PartnersAndBrands.findByIdAndDelete(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Partners and Brands deleted successfully' });
    } catch (error) {
        console.error('Delete PartnersAndBrands error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
