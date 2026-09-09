import { Request, Response } from "express";
import BecomeSponsor from './becomeSponsor.model';


    export const getBecomeSponsor = async (req: Request | any, res: Response | any) => {
        try {
            let data = await BecomeSponsor.findOne();
            if (!data) {
                data = await BecomeSponsor.create({});
            }
            res.json({ success: true, data });
        } catch (error) {
            console.error('Fetch BecomeSponsor error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    export const updateBecomeSponsor = async (req: Request | any, res: Response | any) => {
        try {
            let updateData = { ...req.body };
            
            // Parse nested JSON strings if they come from formData or JSON stringified body
            if (typeof updateData.leftSection === 'string') {
                updateData.leftSection = JSON.parse(updateData.leftSection);
            }
            if (typeof updateData.centerSection === 'string') {
                updateData.centerSection = JSON.parse(updateData.centerSection);
            }
            if (typeof updateData.rightSection === 'string') {
                updateData.rightSection = JSON.parse(updateData.rightSection);
            }

            // Handle file upload for centerSection image
            if (req.files && req.files.image && req.files.image[0]) {
                if (!updateData.centerSection) {
                    updateData.centerSection = {};
                }
                updateData.centerSection.image = `/uploads/organic_expo/${req.files.image[0].filename}`;
            }

            const data = await BecomeSponsor.findOneAndUpdate({}, updateData, { new: true, upsert: true });
            res.json({ success: true, data, message: 'Become Sponsor updated successfully' });
        } catch (error) {
            console.error('Update BecomeSponsor error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }


