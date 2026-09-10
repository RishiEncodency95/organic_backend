import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as testimonialsCarouselController from './testimonialsCarousel.controller';

router.post('/', (req, res) => testimonialsCarouselController.createTestimonials(req, res));
router.get('/', (req, res) => testimonialsCarouselController.getAllTestimonials(req, res));
router.get('/:id', (req, res) => testimonialsCarouselController.getTestimonialsById(req, res));
router.put('/:id', (req, res) => testimonialsCarouselController.updateTestimonialsById(req, res));
router.delete('/:id', (req, res) => testimonialsCarouselController.deleteTestimonialsById(req, res));

export default router;
