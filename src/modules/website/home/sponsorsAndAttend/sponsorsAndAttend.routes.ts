import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as sponsorsAndAttendController from './sponsorsAndAttend.controller';

router.post('/', (req, res) => sponsorsAndAttendController.createSponsorsAndAttend(req, res));
router.get('/', (req, res) => sponsorsAndAttendController.getAllSponsorsAndAttend(req, res));
router.get('/:id', (req, res) => sponsorsAndAttendController.getSponsorsAndAttendById(req, res));
router.put('/:id', (req, res) => sponsorsAndAttendController.updateSponsorsAndAttendById(req, res));
router.delete('/:id', (req, res) => sponsorsAndAttendController.deleteSponsorsAndAttendById(req, res));

export default router;
