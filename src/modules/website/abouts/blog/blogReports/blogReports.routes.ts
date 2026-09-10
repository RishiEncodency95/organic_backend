import express from "express";
import {
  getBlogReports,
  updateBlogReports,
} from "./blogReports.controller";

const router = express.Router();

router.get("/", getBlogReports);
router.put("/", updateBlogReports);

export default router;
