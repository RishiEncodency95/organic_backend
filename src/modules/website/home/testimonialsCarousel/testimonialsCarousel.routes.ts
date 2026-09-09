import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as ctrl from "./testimonialsCarousel.controller";

// @route   GET /api/organic/testimonials-carousel
router.get('/', (req, res) => ctrl.getTestimonials(req, res));

// @route   POST /api/organic/testimonials-carousel
router.post('/', (req, res) => ctrl.updateTestimonials(req, res));

export default router;




