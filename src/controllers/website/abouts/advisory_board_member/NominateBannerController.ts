import { Request, Response } from 'express';
import NominateBanner from '../../../../models/website/abouts/advisory_board_member/NominateBanner';

export const createNominateBanner = async (req: Request, res: Response) => {
    try {
        const newData = new NominateBanner(req.body);
        const savedData = await newData.save();
        res.status(201).json(savedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getNominateBanners = async (req: Request, res: Response) => {
    try {
        const data = await NominateBanner.find();
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getNominateBannerById = async (req: Request, res: Response) => {
    try {
        const data = await NominateBanner.findById(req.params.id);
        if (!data) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateNominateBanner = async (req: Request, res: Response) => {
    try {
        const updatedData = await NominateBanner.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json(updatedData);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteNominateBanner = async (req: Request, res: Response) => {
    try {
        const deletedData = await NominateBanner.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
