import { Router } from "express";
import {
  getTestimonialsCarousel,
  updateTestimonialsCarousel,
} from "./testimonialsCarousel.controller";

const router = Router();

router.get("/", getTestimonialsCarousel);
router.put("/", updateTestimonialsCarousel);
router.post("/", updateTestimonialsCarousel);

export default router;
