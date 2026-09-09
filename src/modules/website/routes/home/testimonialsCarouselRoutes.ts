import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as testimonialsCarouselController from "../../controllers/home/testimonialsCarouselController";

// @route   GET /api/organic/testimonials-carousel
router.get('/', (req, res) => testimonialsCarouselController.getTestimonials(req, res));

// @route   POST /api/organic/testimonials-carousel
router.post('/', (req, res) => testimonialsCarouselController.updateTestimonials(req, res));

export default router;
