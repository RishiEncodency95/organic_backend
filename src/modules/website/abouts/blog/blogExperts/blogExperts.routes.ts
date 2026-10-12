import express from "express";
import {
  getBlogExperts,
  updateBlogExperts,
} from "./blogExperts.controller";
import { protect } from "../../../../../middlewares/auth.middleware";

const router = express.Router();

router.get("/", getBlogExperts);
// Older single-record section (experts now live in /api/blog-experts); changing it needs an admin login
router.put("/", protect, updateBlogExperts);

export default router;
