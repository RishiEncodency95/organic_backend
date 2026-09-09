import express from "express";
import {
    createEventOverview,
    getAllEventOverview,
    getEventOverviewById,
    updateEventOverviewById,
    deleteEventOverviewById
} from "../../../controllers/abouts/about/eventOverviewController";

const router = express.Router();

router.post('/', createEventOverview);
router.get('/', getAllEventOverview);
router.get('/:id', getEventOverviewById);
router.put('/:id', updateEventOverviewById);
router.delete('/:id', deleteEventOverviewById);

export default router;
