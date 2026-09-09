import express from "express";
import {
    createVisionMission,
    getAllVisionMission,
    getVisionMissionById,
    updateVisionMissionById,
    deleteVisionMissionById
} from "../../../controllers/abouts/about/visionMissionController";

const router = express.Router();

router.post('/', createVisionMission);
router.get('/', getAllVisionMission);
router.get('/:id', getVisionMissionById);
router.put('/:id', updateVisionMissionById);
router.delete('/:id', deleteVisionMissionById);

export default router;
