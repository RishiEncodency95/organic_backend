import { Router } from "express";
import {
  getGalleryCounters,
  updateGalleryCounters,
} from "./galleryCounters.controller";

const router = Router();

router.get("/", getGalleryCounters);
router.put("/", updateGalleryCounters);
router.post("/", updateGalleryCounters);

export default router;
