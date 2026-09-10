import express from "express";
import {
  getNominateBanner,
  updateNominateBanner,
} from "./nominateBanner.controller";

const router = express.Router();

router.get("/", getNominateBanner);
router.put("/", updateNominateBanner);

export default router;
