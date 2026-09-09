import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as sponsorsAndAttendController from "../../controllers/home/sponsorsAndAttendController";

// @route   GET /api/organic/sponsors-and-attend
router.get('/', (req, res) => sponsorsAndAttendController.getSponsorsAndAttend(req, res));

// @route   POST /api/organic/sponsors-and-attend
router.post('/', (req, res) => sponsorsAndAttendController.updateSponsorsAndAttend(req, res));

export default router;
