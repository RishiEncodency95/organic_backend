import express from "express";
import {
  getBlogFeatured,
  updateBlogFeatured,
} from "./blogFeatured.controller";
import { protect } from "../../../../../middlewares/auth.middleware";

const router = express.Router();

router.get("/", getBlogFeatured);
router.put("/", protect, updateBlogFeatured);

export default router;
