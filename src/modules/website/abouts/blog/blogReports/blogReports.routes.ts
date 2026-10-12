import express from "express";
import {
  getBlogReports,
  updateBlogReports,
} from "./blogReports.controller";
import { protect } from "../../../../../middlewares/auth.middleware";

const router = express.Router();

router.get("/", getBlogReports);
router.put("/", protect, updateBlogReports);

export default router;
