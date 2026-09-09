import express from "express";
import {
    createAboutFaq,
    getAllAboutFaq,
    getAboutFaqById,
    updateAboutFaqById,
    deleteAboutFaqById
} from "../../../controllers/abouts/about/aboutFaqController";

const router = express.Router();

router.post('/', createAboutFaq);
router.get('/', getAllAboutFaq);
router.get('/:id', getAboutFaqById);
router.put('/:id', updateAboutFaqById);
router.delete('/:id', deleteAboutFaqById);

export default router;
