import express from "express";
import {
    createAboutOrganizer,
    getAllAboutOrganizer,
    getAboutOrganizerById,
    updateAboutOrganizerById,
    deleteAboutOrganizerById
} from "../../../controllers/abouts/about/aboutOrganizerController";

const router = express.Router();

router.post('/', createAboutOrganizer);
router.get('/', getAllAboutOrganizer);
router.get('/:id', getAboutOrganizerById);
router.put('/:id', updateAboutOrganizerById);
router.delete('/:id', deleteAboutOrganizerById);

export default router;
