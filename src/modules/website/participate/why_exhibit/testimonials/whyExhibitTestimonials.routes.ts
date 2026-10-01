import { Router } from "express";
import {
  getWhyExhibitTestimonials,
  updateWhyExhibitTestimonials,
} from "./whyExhibitTestimonials.controller";

const router = Router();

// The whole list is read and saved as one document, like /website/home/testimonials-carousel.
router.get("/", getWhyExhibitTestimonials);
router.put("/", updateWhyExhibitTestimonials);

export default router;
