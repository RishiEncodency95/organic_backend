import express from "express";
import {
  getBlogStats,
  updateBlogStats,
} from "./blogStats.controller";
import { protect } from "../../../../../middlewares/auth.middleware";

const router = express.Router();

router.get("/", getBlogStats);
router.put("/", protect, updateBlogStats);

export default router;
