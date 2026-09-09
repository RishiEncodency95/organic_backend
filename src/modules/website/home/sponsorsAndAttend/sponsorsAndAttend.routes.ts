import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as ctrl from "./sponsorsAndAttend.controller";

// @route   GET /api/organic/sponsors-and-attend
router.get('/', (req, res) => ctrl.getSponsorsAndAttend(req, res));

// @route   POST /api/organic/sponsors-and-attend
router.post('/', (req, res) => ctrl.updateSponsorsAndAttend(req, res));

export default router;




