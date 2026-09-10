import express from "express";
import {
  getBlogStats,
  updateBlogStats,
} from "./blogStats.controller";

const router = express.Router();

router.get("/", getBlogStats);
router.put("/", updateBlogStats);

export default router;
