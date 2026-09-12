import { Router } from "express";
import {
  getAllWhyExhibitTestimonials,
  createWhyExhibitTestimonials,
  getWhyExhibitTestimonialsById,
  updateWhyExhibitTestimonialsById,
  deleteWhyExhibitTestimonialsById,
} from "./whyExhibitTestimonials.controller";

const router = Router();

router.get("/", getAllWhyExhibitTestimonials);
router.post("/", createWhyExhibitTestimonials);

router.get("/:id", getWhyExhibitTestimonialsById);
router.put("/:id", updateWhyExhibitTestimonialsById);
router.delete("/:id", deleteWhyExhibitTestimonialsById);

export default router;
