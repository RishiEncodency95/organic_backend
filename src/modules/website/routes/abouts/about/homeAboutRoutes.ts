import express from "express";
import {
    createHomeAbout,
    getAllHomeAbout,
    getHomeAboutById,
    updateHomeAboutById,
    deleteHomeAboutById
} from "../../../controllers/abouts/about/homeAboutController";

const router = express.Router();

router.post('/', createHomeAbout);
router.get('/', getAllHomeAbout);
router.get('/:id', getHomeAboutById);
router.put('/:id', updateHomeAboutById);
router.delete('/:id', deleteHomeAboutById);

export default router;
