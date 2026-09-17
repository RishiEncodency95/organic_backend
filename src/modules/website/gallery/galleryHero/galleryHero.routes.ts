import { Router } from "express";
import { getGalleryHero, updateGalleryHero } from "./galleryHero.controller";

const router = Router();

router.get("/", getGalleryHero);
router.put("/", updateGalleryHero);
router.post("/", updateGalleryHero);

export default router;
