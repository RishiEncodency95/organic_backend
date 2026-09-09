import express from "express";
import {
    createAboutVenue,
    getAllAboutVenue,
    getAboutVenueById,
    updateAboutVenueById,
    deleteAboutVenueById
} from "../../../controllers/abouts/about/aboutVenueController";

const router = express.Router();

router.post('/', createAboutVenue);
router.get('/', getAllAboutVenue);
router.get('/:id', getAboutVenueById);
router.put('/:id', updateAboutVenueById);
router.delete('/:id', deleteAboutVenueById);

export default router;
